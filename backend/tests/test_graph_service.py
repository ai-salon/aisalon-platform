"""Tests for GraphIngestionService."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.models.graph import GraphEdge, GraphMergeCandidate, GraphNode
from app.services.graph import GraphIngestionService


_FAKE_EMBEDDING = [0.1] * 768


def _make_candidate(label: str, description: str = "desc", type: str = "concept"):
    c = MagicMock()
    c.label = label
    c.description = description
    c.type = type
    return c


def _make_extraction(concepts=None, questions=None, article_properties=None):
    ex = MagicMock()
    ex.concept_candidates = concepts or []
    ex.question_candidates = questions or []
    ex.article_properties = article_properties or {}
    return ex


async def _seed_article(session: AsyncSession, chapter_id: str, title: str = "Test") -> Article:
    art = Article(
        chapter_id=chapter_id,
        title=title,
        content_md="",
        status=ArticleStatus.draft,
    )
    session.add(art)
    await session.commit()
    await session.refresh(art)
    return art


async def _seed_chapter(session: AsyncSession):
    from app.models.chapter import Chapter
    ch = Chapter(
        code="sf", name="SF", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


# ---------------------------------------------------------------------------
# Node / edge helpers
# ---------------------------------------------------------------------------

class TestUpsertArticleNode:
    async def test_creates_article_node(self, db_session: AsyncSession, sf_chapter):
        art = await _seed_article(db_session, sf_chapter.id)
        svc = GraphIngestionService(db_session, "dummy-key")

        node = await svc._upsert_article_node(
            article_id=art.id,
            chapter_id=art.chapter_id,
            publish_date=None,
            article_properties={"sentiment": "positive"},
        )
        await db_session.commit()

        assert node.type == "article"
        assert node.label == "Test"
        assert node.external_table == "articles"
        assert node.external_id == art.id
        assert node.properties["sentiment"] == "positive"

    async def test_returns_existing_node(self, db_session: AsyncSession, sf_chapter):
        art = await _seed_article(db_session, sf_chapter.id)
        svc = GraphIngestionService(db_session, "dummy-key")

        node1 = await svc._upsert_article_node(art.id, art.chapter_id, None, {})
        await db_session.commit()
        node2 = await svc._upsert_article_node(art.id, art.chapter_id, None, {})
        await db_session.commit()

        assert node1.id == node2.id


class TestCreateNode:
    async def test_creates_concept_node(self, db_session: AsyncSession):
        svc = GraphIngestionService(db_session, "dummy-key")
        candidate = _make_candidate("Democracy", "political system", "concept")

        node_id = await svc._create_node(candidate, json.dumps(_FAKE_EMBEDDING), parent_id=None)
        await db_session.commit()

        result = await db_session.execute(select(GraphNode).where(GraphNode.id == node_id))
        node = result.scalar_one()
        assert node.type == "concept"
        assert node.label == "Democracy"
        assert node.description == "political system"
        assert node.parent_id is None

    async def test_creates_child_node(self, db_session: AsyncSession):
        svc = GraphIngestionService(db_session, "dummy-key")
        parent_cand = _make_candidate("Politics")
        parent_id = await svc._create_node(parent_cand, json.dumps(_FAKE_EMBEDDING), parent_id=None)
        await db_session.commit()

        child_cand = _make_candidate("Electoral Reform")
        child_id = await svc._create_node(child_cand, json.dumps(_FAKE_EMBEDDING), parent_id=parent_id)
        await db_session.commit()

        result = await db_session.execute(select(GraphNode).where(GraphNode.id == child_id))
        child = result.scalar_one()
        assert child.parent_id == parent_id


class TestUpsertEdge:
    async def test_creates_edge(self, db_session: AsyncSession):
        svc = GraphIngestionService(db_session, "dummy-key")
        n1_id = await svc._create_node(_make_candidate("A"), json.dumps(_FAKE_EMBEDDING), None)
        n2_id = await svc._create_node(_make_candidate("B"), json.dumps(_FAKE_EMBEDDING), None)
        await db_session.commit()

        await svc._upsert_edge(n1_id, n2_id, "article_discusses")
        await db_session.commit()

        result = await db_session.execute(
            select(GraphEdge).where(
                GraphEdge.source_id == n1_id,
                GraphEdge.target_id == n2_id,
            )
        )
        edge = result.scalar_one()
        assert edge.edge_type == "article_discusses"
        assert edge.weight == 1.0

    async def test_increments_weight_on_duplicate(self, db_session: AsyncSession):
        svc = GraphIngestionService(db_session, "dummy-key")
        n1_id = await svc._create_node(_make_candidate("A"), json.dumps(_FAKE_EMBEDDING), None)
        n2_id = await svc._create_node(_make_candidate("B"), json.dumps(_FAKE_EMBEDDING), None)
        await db_session.commit()

        await svc._upsert_edge(n1_id, n2_id, "article_discusses")
        await db_session.commit()
        await svc._upsert_edge(n1_id, n2_id, "article_discusses")
        await db_session.commit()

        result = await db_session.execute(
            select(GraphEdge).where(GraphEdge.source_id == n1_id, GraphEdge.target_id == n2_id)
        )
        edge = result.scalar_one()
        assert edge.weight == 2.0


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

class TestMergeNodes:
    async def _setup_two_nodes(self, db_session: AsyncSession) -> tuple[str, str, str]:
        """Returns (article_node_id, concept_a_id, concept_b_id)."""
        svc = GraphIngestionService(db_session, "dummy-key")
        art_id = await svc._create_node(_make_candidate("Article", type="article"), json.dumps(_FAKE_EMBEDDING), None)
        a_id = await svc._create_node(_make_candidate("AI Safety"), json.dumps(_FAKE_EMBEDDING), None)
        b_id = await svc._create_node(_make_candidate("AI Alignment"), json.dumps(_FAKE_EMBEDDING), None)
        await svc._upsert_edge(art_id, a_id, "article_discusses")
        await svc._upsert_edge(art_id, b_id, "article_discusses")
        await db_session.commit()
        return art_id, a_id, b_id

    async def test_repoints_edges_to_keep(self, db_session: AsyncSession):
        art_id, keep_id, discard_id = await self._setup_two_nodes(db_session)
        svc = GraphIngestionService(db_session, "dummy-key")

        await svc.merge_nodes(keep_id, discard_id)

        # discard's edge to article should now point from keep
        result = await db_session.execute(
            select(GraphEdge).where(GraphEdge.target_id == keep_id)
        )
        edges = result.scalars().all()
        assert len(edges) >= 1

    async def test_deletes_discard_node(self, db_session: AsyncSession):
        _, keep_id, discard_id = await self._setup_two_nodes(db_session)
        svc = GraphIngestionService(db_session, "dummy-key")

        await svc.merge_nodes(keep_id, discard_id)

        result = await db_session.execute(
            select(GraphNode).where(GraphNode.id == discard_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_marks_merge_candidates_resolved(self, db_session: AsyncSession):
        _, keep_id, discard_id = await self._setup_two_nodes(db_session)
        svc = GraphIngestionService(db_session, "dummy-key")

        # Seed a pending merge candidate
        mc = GraphMergeCandidate(node_a_id=discard_id, node_b_id=keep_id, similarity=0.85)
        db_session.add(mc)
        await db_session.commit()

        await svc.merge_nodes(keep_id, discard_id)

        result = await db_session.execute(
            select(GraphMergeCandidate).where(GraphMergeCandidate.id == mc.id)
        )
        mc_after = result.scalar_one()
        assert mc_after.status == "merged"


# ---------------------------------------------------------------------------
# Full ingest_article pipeline (mocked external calls)
# ---------------------------------------------------------------------------

class TestIngestArticle:
    async def test_creates_nodes_and_edges(self, db_session: AsyncSession, sf_chapter):
        import sys

        art = await _seed_article(db_session, sf_chapter.id, "AI and Democracy")
        svc = GraphIngestionService(db_session, "dummy-key")

        concept = _make_candidate("Democracy", "desc", "concept")
        question = _make_candidate("What is AI?", "q desc", "question")
        extraction = _make_extraction(concepts=[concept], questions=[question])

        MockExtractorClass = MagicMock(return_value=MagicMock(extract=MagicMock(return_value=extraction)))
        mock_kg_mod = MagicMock()
        mock_kg_mod.GraphExtractor = MockExtractorClass

        mock_modules = {
            "socraticai": MagicMock(),
            "socraticai.content": MagicMock(),
            "socraticai.content.knowledge_graph": MagicMock(),
            "socraticai.content.knowledge_graph.graph_extractor": mock_kg_mod,
        }

        with (
            patch(
                "app.services.graph.GraphIngestionService._compute_embedding",
                new=AsyncMock(return_value=_FAKE_EMBEDDING),
            ),
            patch.dict(sys.modules, mock_modules),
        ):
            meta = {"analysis": {"themes": "", "insights": "", "questions": ""}}
            await svc.ingest_article(
                article_id=art.id,
                chapter_id=art.chapter_id,
                publish_date=None,
                meta=meta,
            )

        # Article node should exist
        result = await db_session.execute(
            select(GraphNode).where(
                GraphNode.external_table == "articles",
                GraphNode.external_id == art.id,
            )
        )
        article_node = result.scalar_one_or_none()
        assert article_node is not None

    async def test_skips_on_import_error(self, db_session: AsyncSession, sf_chapter):
        """If socraticai is not installed, ingest_article returns gracefully."""
        art = await _seed_article(db_session, sf_chapter.id)
        svc = GraphIngestionService(db_session, "dummy-key")

        import sys
        # Temporarily remove socraticai from sys.modules to force ImportError
        mods_to_hide = [k for k in sys.modules if k.startswith("socraticai")]
        saved = {k: sys.modules.pop(k) for k in mods_to_hide}
        # Block the import
        sys.modules["socraticai"] = None  # type: ignore[assignment]
        sys.modules["socraticai.content"] = None  # type: ignore[assignment]
        sys.modules["socraticai.content.knowledge_graph"] = None  # type: ignore[assignment]
        sys.modules["socraticai.content.knowledge_graph.graph_extractor"] = None  # type: ignore[assignment]

        try:
            await svc.ingest_article(art.id, art.chapter_id, None, {})
        finally:
            for k in ["socraticai", "socraticai.content",
                       "socraticai.content.knowledge_graph",
                       "socraticai.content.knowledge_graph.graph_extractor"]:
                sys.modules.pop(k, None)
            sys.modules.update(saved)

        # Should not raise; no article node created
        result = await db_session.execute(
            select(GraphNode).where(GraphNode.type == "article")
        )
        assert result.scalar_one_or_none() is None
