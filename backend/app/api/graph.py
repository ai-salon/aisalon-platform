"""Knowledge graph API routes.

Public:
  GET /graph              — full graph for the visualiser (published articles only)
  GET /graph/nodes/{id}   — node detail + neighbours + linked articles

Admin:
  GET  /admin/graph/nodes                 — full graph incl. drafts
  GET  /admin/graph/merge-candidates      — pending merge candidate list
  POST /admin/graph/merge                 — merge two nodes
  PATCH /admin/graph/nodes/{id}           — edit label / description
  POST /admin/graph/backfill              — trigger backfill of all existing articles
  GET  /admin/graph/backfill/status       — poll backfill progress
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.encryption import decrypt_key
from app.core.logging import get_logger
from app.models.api_key import APIKeyProvider, UserAPIKey
from app.models.article import Article, ArticleStatus
from app.models.graph import GraphEdge, GraphMergeCandidate, GraphNode
from app.models.user import User, UserRole
from app.schemas.graph import (
    BackfillStatus,
    GraphEdgeSummary,
    GraphNodeDetail,
    GraphNodeSummary,
    GraphResponse,
    LinkedArticle,
    MergeCandidateResponse,
    MergeRequest,
    NodeEditRequest,
)
from app.services.graph import GraphIngestionService

logger = get_logger(__name__)

public_router = APIRouter(prefix="/graph", tags=["graph"])
admin_router = APIRouter(prefix="/admin/graph", tags=["graph-admin"])

# In-memory backfill progress (single-server; good enough for now)
_backfill_state: dict = {"running": False, "processed": 0, "total": 0}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_admin(user: User) -> None:
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def _get_google_key(user_id: str, db: AsyncSession) -> str:
    from app.core.config import settings

    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.provider == APIKeyProvider.google,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Google API key not configured. Add it in Settings.",
        )
    return decrypt_key(row.encrypted_key, settings.SECRET_KEY)


def _node_to_summary(node: GraphNode) -> GraphNodeSummary:
    return GraphNodeSummary(
        id=node.id,
        type=node.type,
        label=node.label,
        description=node.description,
        properties=node.properties,
        edge_count=node.edge_count,
        last_activity_at=node.last_activity_at,
        parent_id=node.parent_id,
    )


def _edge_to_summary(edge: GraphEdge) -> GraphEdgeSummary:
    return GraphEdgeSummary(
        source=edge.source_id,
        target=edge.target_id,
        edge_type=edge.edge_type,
        weight=edge.weight,
    )


# ---------------------------------------------------------------------------
# Public routes
# ---------------------------------------------------------------------------

@public_router.get("", response_model=GraphResponse)
async def get_graph(db: AsyncSession = Depends(get_db)):
    """Full graph for published articles only."""
    # Fetch published article node external IDs
    pub_result = await db.execute(
        select(Article.id).where(Article.status == ArticleStatus.published)
    )
    published_ids = set(pub_result.scalars().all())

    # Article nodes for published articles only
    article_nodes_result = await db.execute(
        select(GraphNode).where(
            GraphNode.type == "article",
            GraphNode.external_table == "articles",
            GraphNode.external_id.in_(published_ids),
        )
    )
    article_nodes = article_nodes_result.scalars().all()
    article_node_ids = {n.id for n in article_nodes}

    if not article_node_ids:
        return GraphResponse(nodes=[], edges=[])

    # Edges connected to those article nodes
    edges_result = await db.execute(
        select(GraphEdge).where(
            GraphEdge.source_id.in_(article_node_ids)
            | GraphEdge.target_id.in_(article_node_ids)
        )
    )
    edges = edges_result.scalars().all()

    # Concept/question nodes reachable from published articles
    concept_ids = set()
    for edge in edges:
        concept_ids.add(edge.source_id)
        concept_ids.add(edge.target_id)
    concept_ids -= article_node_ids

    concept_nodes_result = await db.execute(
        select(GraphNode).where(GraphNode.id.in_(concept_ids))
    )
    concept_nodes = concept_nodes_result.scalars().all()

    # Also include concept↔concept edges between reachable concepts
    cc_edges_result = await db.execute(
        select(GraphEdge).where(
            GraphEdge.source_id.in_(concept_ids),
            GraphEdge.target_id.in_(concept_ids),
            GraphEdge.edge_type == "concept_related_to",
        )
    )
    cc_edges = cc_edges_result.scalars().all()

    all_nodes = list(article_nodes) + list(concept_nodes)
    all_edges = list(edges) + list(cc_edges)

    return GraphResponse(
        nodes=[_node_to_summary(n) for n in all_nodes],
        edges=[_edge_to_summary(e) for e in all_edges],
    )


@public_router.get("/nodes/{node_id}", response_model=GraphNodeDetail)
async def get_node_detail(node_id: str, db: AsyncSession = Depends(get_db)):
    """Full node detail: node data + one-hop neighbours + linked articles."""
    result = await db.execute(
        select(GraphNode)
        .where(GraphNode.id == node_id)
        .options(
            selectinload(GraphNode.outgoing_edges),
            selectinload(GraphNode.incoming_edges),
            selectinload(GraphNode.children),
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Collect neighbour IDs (one hop)
    neighbour_ids = set()
    for edge in node.outgoing_edges:
        neighbour_ids.add(edge.target_id)
    for edge in node.incoming_edges:
        neighbour_ids.add(edge.source_id)
    neighbour_ids.discard(node_id)

    neighbours_result = await db.execute(
        select(GraphNode).where(GraphNode.id.in_(neighbour_ids))
    )
    neighbours = neighbours_result.scalars().all()

    # Linked articles (article nodes connected to this node)
    article_node_ids = {
        n.id for n in neighbours if n.type == "article"
    }
    if node.type == "article":
        article_node_ids.add(node_id)

    linked_articles: list[LinkedArticle] = []
    if article_node_ids:
        art_nodes_result = await db.execute(
            select(GraphNode).where(
                GraphNode.id.in_(article_node_ids),
                GraphNode.type == "article",
                GraphNode.external_table == "articles",
            )
        )
        art_nodes = art_nodes_result.scalars().all()
        ext_ids = [n.external_id for n in art_nodes if n.external_id]

        if ext_ids:
            arts_result = await db.execute(
                select(Article).where(
                    Article.id.in_(ext_ids),
                    Article.status == ArticleStatus.published,
                )
            )
            for art in arts_result.scalars().all():
                linked_articles.append(
                    LinkedArticle(
                        id=art.id,
                        title=art.title,
                        chapter_id=art.chapter_id,
                        publish_date=art.publish_date,
                        substack_url=art.substack_url,
                    )
                )

    return GraphNodeDetail(
        id=node.id,
        type=node.type,
        label=node.label,
        description=node.description,
        properties=node.properties,
        edge_count=node.edge_count,
        last_activity_at=node.last_activity_at,
        parent_id=node.parent_id,
        neighbors=[_node_to_summary(n) for n in neighbours],
        linked_articles=linked_articles,
        children=[_node_to_summary(c) for c in node.children],
    )


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@admin_router.get("/nodes", response_model=GraphResponse)
async def admin_get_graph(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full graph including draft articles."""
    _require_admin(current_user)

    nodes_result = await db.execute(select(GraphNode))
    nodes = nodes_result.scalars().all()

    edges_result = await db.execute(select(GraphEdge))
    edges = edges_result.scalars().all()

    return GraphResponse(
        nodes=[_node_to_summary(n) for n in nodes],
        edges=[_edge_to_summary(e) for e in edges],
    )


@admin_router.get("/merge-candidates", response_model=list[MergeCandidateResponse])
async def list_merge_candidates(
    status_filter: str = Query(default="pending", alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    result = await db.execute(
        select(GraphMergeCandidate)
        .where(GraphMergeCandidate.status == status_filter)
        .order_by(GraphMergeCandidate.similarity.desc())
        .options(
            selectinload(GraphMergeCandidate.node_a),
            selectinload(GraphMergeCandidate.node_b),
        )
    )
    candidates = result.scalars().all()

    return [
        MergeCandidateResponse(
            id=c.id,
            node_a=_node_to_summary(c.node_a),
            node_b=_node_to_summary(c.node_b),
            similarity=c.similarity,
            source=c.source,
            status=c.status,
            created_at=c.created_at,
        )
        for c in candidates
    ]


@admin_router.post("/merge", status_code=status.HTTP_200_OK)
async def merge_nodes(
    body: MergeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    google_key = await _get_google_key(current_user.id, db)
    svc = GraphIngestionService(db, google_key)
    await svc.merge_nodes(body.keep_id, body.discard_id)
    return {"status": "merged", "keep_id": body.keep_id}


@admin_router.patch("/nodes/{node_id}", response_model=GraphNodeSummary)
async def edit_node(
    node_id: str,
    body: NodeEditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    result = await db.execute(select(GraphNode).where(GraphNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if body.label is not None:
        node.label = body.label
    if body.description is not None:
        node.description = body.description

    await db.commit()
    await db.refresh(node)
    return _node_to_summary(node)


@admin_router.post("/backfill", status_code=status.HTTP_202_ACCEPTED)
async def start_backfill(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    if _backfill_state["running"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Backfill already running",
        )

    # Count articles with meta
    count_result = await db.execute(
        select(Article).where(
            Article.meta.isnot(None),
        )
    )
    articles = count_result.scalars().all()
    total = len(articles)
    article_ids = [(a.id, a.chapter_id, a.publish_date, a.meta) for a in articles]

    google_key = await _get_google_key(current_user.id, db)

    _backfill_state.update({"running": True, "processed": 0, "total": total})
    background_tasks.add_task(_run_backfill, article_ids, google_key)

    return {"status": "started", "article_count": total}


@admin_router.get("/backfill/status", response_model=BackfillStatus)
async def backfill_status(
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    return BackfillStatus(
        processed=_backfill_state["processed"],
        total=_backfill_state["total"],
        complete=not _backfill_state["running"],
    )


# ---------------------------------------------------------------------------
# Backfill background task
# ---------------------------------------------------------------------------

async def _run_backfill(
    article_data: list[tuple],
    google_key: str,
) -> None:
    """Process all articles through graph ingestion (no auto-merge)."""
    _backfill_state["processed"] = 0

    async with AsyncSessionLocal() as db:
        for article_id, chapter_id, publish_date, meta in article_data:
            try:
                svc = GraphIngestionService(db, google_key)
                await svc.ingest_article(
                    article_id=article_id,
                    chapter_id=chapter_id,
                    publish_date=publish_date,
                    meta=meta or {},
                    source="backfill",
                )
            except Exception as exc:
                logger.error("backfill_article_failed", article_id=article_id, error=str(exc))
            finally:
                _backfill_state["processed"] += 1

    _backfill_state["running"] = False
    logger.info("backfill_complete", total=_backfill_state["total"])
