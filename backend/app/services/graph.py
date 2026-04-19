"""Graph ingestion service.

Receives NodeCandidates from SocraticAI's GraphExtractor, computes
embeddings, deduplicates via pgvector cosine similarity, and writes
nodes + edges to PostgreSQL.

Similarity thresholds (concept/question nodes):
  >= 0.90          → auto-merge into existing node
  0.72 – 0.90      → create node, queue for admin review
  0.60 – 0.72      → create as child concept (parent_id = most similar theme)
  < 0.60           → create as new peer node

Backfill rule: when source='backfill', no auto-merging —
everything >= 0.72 is queued for review.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, text, update, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import GraphEdge, GraphMergeCandidate, GraphNode
from app.core.logging import get_logger

logger = get_logger(__name__)

# Similarity thresholds
AUTO_MERGE_THRESHOLD = 0.90
REVIEW_THRESHOLD = 0.72
CHILD_THRESHOLD = 0.60

# Co-occurrence count required to derive a concept↔concept edge
COOCCURRENCE_MIN = 3


class GraphIngestionService:
    """
    Ingest one article's graph candidates into the platform database.

    Usage:
        svc = GraphIngestionService(db, google_api_key)
        await svc.ingest_article(article_id, chapter_id, publish_date, meta)
    """

    def __init__(self, db: AsyncSession, google_api_key: str) -> None:
        self._db = db
        self._google_api_key = google_api_key

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def ingest_article(
        self,
        article_id: str,
        chapter_id: str,
        publish_date: Any | None,
        meta: dict,
        source: str = "ingestion",
    ) -> None:
        """
        Full ingestion pipeline for one article.

        source='ingestion' — normal processing, auto-merge enabled
        source='backfill'  — no auto-merging, everything >= 0.72 queued
        """
        try:
            from socraticai.content.knowledge_graph.graph_extractor import GraphExtractor
        except ImportError:
            logger.warning("graph_extraction_skipped", reason="socraticai not installed")
            return

        extraction = GraphExtractor(meta).extract()

        # 1. Upsert article node
        article_node = await self._upsert_article_node(
            article_id=article_id,
            chapter_id=chapter_id,
            publish_date=publish_date,
            article_properties=extraction.article_properties,
        )

        # 2. Process concept candidates
        concept_node_ids: list[str] = []
        for candidate in extraction.concept_candidates:
            node_id = await self._process_candidate(candidate, article_node.id, source)
            if node_id:
                concept_node_ids.append(node_id)

        # 3. Process question candidates
        for candidate in extraction.question_candidates:
            await self._process_candidate(candidate, article_node.id, source)

        # 4. Derive concept↔concept edges from co-occurrence
        await self._derive_cooccurrence_edges()

        await self._db.commit()
        logger.info(
            "graph_ingest_complete",
            article_id=article_id,
            concepts=len(extraction.concept_candidates),
            questions=len(extraction.question_candidates),
        )

    # ------------------------------------------------------------------
    # Node management
    # ------------------------------------------------------------------

    async def _upsert_article_node(
        self,
        article_id: str,
        chapter_id: str,
        publish_date: Any | None,
        article_properties: dict,
    ) -> GraphNode:
        """Create or retrieve the article's graph node."""
        result = await self._db.execute(
            select(GraphNode).where(
                GraphNode.external_table == "articles",
                GraphNode.external_id == article_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        # Import here to avoid circular at module level
        from app.models.article import Article

        art_result = await self._db.execute(
            select(Article.title).where(Article.id == article_id)
        )
        title = art_result.scalar_one_or_none() or "Untitled"

        node = GraphNode(
            type="article",
            label=title,
            external_table="articles",
            external_id=article_id,
            properties={
                "chapter_id": chapter_id,
                "publish_date": str(publish_date) if publish_date else None,
                **article_properties,
            },
        )
        self._db.add(node)
        await self._db.flush()
        return node

    async def _process_candidate(
        self,
        candidate: Any,
        article_node_id: str,
        source: str,
    ) -> str | None:
        """
        Embed one candidate, find similar existing nodes, route per thresholds.
        Returns the node_id that was created or merged into.
        """
        label = candidate.label.strip()
        if not label:
            return None

        # Context prefix stabilises short-string embeddings
        prefix = "Topic: " if candidate.type == "concept" else "Question: "
        embedding = await self._compute_embedding(prefix + label)
        embedding_json = json.dumps(embedding)

        similar = await self._find_similar_nodes(embedding, candidate.type)

        node_id: str | None = None

        if similar:
            top_id, top_label, top_sim = similar[0]

            if top_sim >= AUTO_MERGE_THRESHOLD and source != "backfill":
                # Auto-merge: reuse existing node
                node_id = top_id
                await self._update_node_description(top_id, candidate.description)
                logger.info("graph_auto_merge", label=label, into=top_label, sim=top_sim)

            elif top_sim >= REVIEW_THRESHOLD:
                # Create node, queue for review
                node_id = await self._create_node(candidate, embedding_json, parent_id=None)
                await self._queue_merge_candidate(node_id, top_id, top_sim, source)

            elif candidate.type == "concept" and top_sim >= CHILD_THRESHOLD:
                # Create as child of the most similar theme concept
                node_id = await self._create_node(
                    candidate, embedding_json, parent_id=top_id
                )

            else:
                node_id = await self._create_node(candidate, embedding_json, parent_id=None)

        else:
            node_id = await self._create_node(candidate, embedding_json, parent_id=None)

        if node_id:
            edge_type = (
                "article_discusses" if candidate.type == "concept" else "article_raises"
            )
            await self._upsert_edge(article_node_id, node_id, edge_type)
            await self._touch_node(node_id)

        return node_id

    async def _create_node(
        self,
        candidate: Any,
        embedding_json: str,
        parent_id: str | None,
    ) -> str:
        node = GraphNode(
            type=candidate.type,
            label=candidate.label.strip(),
            description=candidate.description,
            embedding=embedding_json,
            parent_id=parent_id,
        )
        self._db.add(node)
        await self._db.flush()
        return node.id

    async def _update_node_description(self, node_id: str, new_description: str) -> None:
        """Re-synthesize description on merge (max 5 times per node)."""
        result = await self._db.execute(
            select(GraphNode.description, GraphNode.properties).where(GraphNode.id == node_id)
        )
        row = result.one_or_none()
        if not row:
            return

        existing_desc, props = row
        props = props or {}
        synthesis_count = props.get("synthesis_count", 0)

        if synthesis_count >= 5 or not existing_desc:
            return

        synthesized = await self._synthesize_description(existing_desc, new_description)
        await self._db.execute(
            update(GraphNode)
            .where(GraphNode.id == node_id)
            .values(
                description=synthesized,
                properties={**props, "synthesis_count": synthesis_count + 1},
            )
        )

    async def _touch_node(self, node_id: str) -> None:
        """Increment edge_count and update last_activity_at."""
        await self._db.execute(
            update(GraphNode)
            .where(GraphNode.id == node_id)
            .values(
                edge_count=GraphNode.edge_count + 1,
                last_activity_at=datetime.now(timezone.utc),
            )
        )

    # ------------------------------------------------------------------
    # Edges
    # ------------------------------------------------------------------

    async def _upsert_edge(
        self, source_id: str, target_id: str, edge_type: str
    ) -> None:
        """Create edge or increment weight if it already exists."""
        result = await self._db.execute(
            select(GraphEdge).where(
                GraphEdge.source_id == source_id,
                GraphEdge.target_id == target_id,
                GraphEdge.edge_type == edge_type,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.weight += 1.0
        else:
            self._db.add(
                GraphEdge(source_id=source_id, target_id=target_id, edge_type=edge_type)
            )
        await self._db.flush()

    async def _derive_cooccurrence_edges(self) -> None:
        """
        For any two concept nodes that share >= COOCCURRENCE_MIN article edges,
        upsert a concept_related_to edge with weight = shared article count.
        """
        try:
            result = await self._db.execute(
                text("""
                    SELECT a.target_id AS concept_a,
                           b.target_id AS concept_b,
                           COUNT(DISTINCT a.source_id) AS shared
                    FROM graph_edges a
                    JOIN graph_edges b
                        ON a.source_id = b.source_id
                        AND a.target_id < b.target_id
                    JOIN graph_nodes na ON na.id = a.target_id AND na.type = 'concept'
                    JOIN graph_nodes nb ON nb.id = b.target_id AND nb.type = 'concept'
                    WHERE a.edge_type = 'article_discusses'
                      AND b.edge_type = 'article_discusses'
                    GROUP BY a.target_id, b.target_id
                    HAVING COUNT(DISTINCT a.source_id) >= :min_count
                """),
                {"min_count": COOCCURRENCE_MIN},
            )
            pairs = result.fetchall()
        except Exception as exc:
            logger.warning("cooccurrence_query_failed", error=str(exc))
            return

        for row in pairs:
            existing = await self._db.execute(
                select(GraphEdge).where(
                    GraphEdge.source_id == row.concept_a,
                    GraphEdge.target_id == row.concept_b,
                    GraphEdge.edge_type == "concept_related_to",
                )
            )
            edge = existing.scalar_one_or_none()
            if edge:
                edge.weight = float(row.shared)
            else:
                self._db.add(
                    GraphEdge(
                        source_id=row.concept_a,
                        target_id=row.concept_b,
                        edge_type="concept_related_to",
                        weight=float(row.shared),
                    )
                )
        if pairs:
            await self._db.flush()

    # ------------------------------------------------------------------
    # Merge candidates
    # ------------------------------------------------------------------

    async def _queue_merge_candidate(
        self, node_id: str, similar_id: str, similarity: float, source: str
    ) -> None:
        self._db.add(
            GraphMergeCandidate(
                node_a_id=node_id,
                node_b_id=similar_id,
                similarity=similarity,
                source=source,
            )
        )
        await self._db.flush()

    # ------------------------------------------------------------------
    # Merging (admin action)
    # ------------------------------------------------------------------

    async def merge_nodes(self, keep_id: str, discard_id: str) -> None:
        """
        Merge discard_node into keep_node:
        - Repoint all edges from/to discard → keep
        - Mark merge candidates as merged
        - Delete discard node
        """
        # Before repointing, delete outgoing edges that would conflict
        # (discard→target already exists as keep→target with same edge_type)
        await self._db.execute(
            text("""
                DELETE FROM graph_edges
                WHERE source_id = :discard_id
                  AND id IN (
                    SELECT ge1.id FROM graph_edges ge1
                    INNER JOIN graph_edges ge2
                        ON ge2.target_id = ge1.target_id
                        AND ge2.source_id = :keep_id
                        AND ge2.edge_type = ge1.edge_type
                    WHERE ge1.source_id = :discard_id
                  )
            """),
            {"discard_id": discard_id, "keep_id": keep_id},
        )
        # Before repointing, delete incoming edges that would conflict
        # (source→discard already exists as source→keep with same edge_type)
        await self._db.execute(
            text("""
                DELETE FROM graph_edges
                WHERE target_id = :discard_id
                  AND id IN (
                    SELECT ge1.id FROM graph_edges ge1
                    INNER JOIN graph_edges ge2
                        ON ge2.source_id = ge1.source_id
                        AND ge2.target_id = :keep_id
                        AND ge2.edge_type = ge1.edge_type
                    WHERE ge1.target_id = :discard_id
                  )
            """),
            {"discard_id": discard_id, "keep_id": keep_id},
        )
        # Repoint outgoing edges
        await self._db.execute(
            update(GraphEdge)
            .where(GraphEdge.source_id == discard_id)
            .values(source_id=keep_id)
        )
        # Repoint incoming edges
        await self._db.execute(
            update(GraphEdge)
            .where(GraphEdge.target_id == discard_id)
            .values(target_id=keep_id)
        )
        # Remove self-loops created by the repoint
        await self._db.execute(
            text("DELETE FROM graph_edges WHERE source_id = target_id")
        )
        # Mark merge candidates resolved
        await self._db.execute(
            update(GraphMergeCandidate)
            .where(
                (GraphMergeCandidate.node_a_id == discard_id)
                | (GraphMergeCandidate.node_b_id == discard_id)
            )
            .values(status="merged")
        )
        # Repoint children
        await self._db.execute(
            update(GraphNode)
            .where(GraphNode.parent_id == discard_id)
            .values(parent_id=keep_id)
        )
        # Delete discard
        discard = await self._db.get(GraphNode, discard_id)
        if discard:
            await self._db.delete(discard)

        # Recalculate edge_count for keep node
        count_result = await self._db.execute(
            select(func.count()).where(
                (GraphEdge.source_id == keep_id) | (GraphEdge.target_id == keep_id)
            )
        )
        edge_count = count_result.scalar_one() or 0
        await self._db.execute(
            update(GraphNode).where(GraphNode.id == keep_id).values(edge_count=edge_count)
        )
        await self._db.commit()

    # ------------------------------------------------------------------
    # Embedding + similarity
    # ------------------------------------------------------------------

    async def _compute_embedding(self, text_input: str) -> list[float]:
        """Compute embedding via Google text-embedding-004."""
        try:
            from google import genai as google_genai

            client = google_genai.Client(api_key=self._google_api_key)
            result = client.models.embed_content(
                model="text-embedding-004",
                contents=[text_input],
            )
            return list(result.embeddings[0].values)
        except Exception as exc:
            logger.error("embedding_failed", error=str(exc), text=text_input[:80])
            raise

    async def _find_similar_nodes(
        self, embedding: list[float], node_type: str
    ) -> list[tuple[str, str, float]]:
        """
        Return top-3 most similar nodes of the given type by cosine similarity.

        Uses PostgreSQL + pgvector. Returns [] gracefully for SQLite / missing extension.
        """
        embedding_json = json.dumps(embedding)
        try:
            result = await self._db.execute(
                text("""
                    SELECT id, label,
                           1 - (embedding::vector(768) <=> :query_vec::vector(768)) AS similarity
                    FROM graph_nodes
                    WHERE type = :node_type
                      AND embedding IS NOT NULL
                    ORDER BY embedding::vector(768) <=> :query_vec::vector(768)
                    LIMIT 3
                """),
                {"query_vec": embedding_json, "node_type": node_type},
            )
            return [(row.id, row.label, float(row.similarity)) for row in result]
        except Exception as exc:
            logger.warning(
                "similarity_search_unavailable",
                reason=str(exc)[:120],
                hint="pgvector may not be enabled or DB is SQLite",
            )
            return []

    async def _synthesize_description(self, existing: str, new: str) -> str:
        """Merge two descriptions via Gemini Flash (cheap single call)."""
        try:
            from google import genai as google_genai

            client = google_genai.Client(api_key=self._google_api_key)
            prompt = (
                "Given two descriptions of the same concept, write one synthesized "
                "paragraph (2-3 sentences) combining both perspectives.\n\n"
                f"Existing: {existing}\n\nNew: {new}\n\n"
                "Return only the synthesized paragraph."
            )
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception as exc:
            logger.warning("description_synthesis_failed", error=str(exc))
            return existing  # fallback: keep existing
