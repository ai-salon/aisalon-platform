"""Tests for /graph and /admin/graph routes."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.models.graph import GraphEdge, GraphMergeCandidate, GraphNode


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

async def _seed_article_node(
    session: AsyncSession,
    article_id: str,
    chapter_id: str,
) -> GraphNode:
    node = GraphNode(
        type="article",
        label="Test Article",
        external_table="articles",
        external_id=article_id,
    )
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node


async def _seed_concept_node(
    session: AsyncSession, label: str = "Democracy"
) -> GraphNode:
    node = GraphNode(type="concept", label=label, description="A concept")
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node


async def _seed_edge(
    session: AsyncSession, source_id: str, target_id: str, edge_type: str = "article_discusses"
) -> GraphEdge:
    edge = GraphEdge(source_id=source_id, target_id=target_id, edge_type=edge_type)
    session.add(edge)
    await session.commit()
    await session.refresh(edge)
    return edge


async def _seed_article(
    session: AsyncSession, chapter_id: str, status: ArticleStatus = ArticleStatus.published
) -> Article:
    art = Article(
        chapter_id=chapter_id,
        title="AI and Democracy",
        content_md="",
        status=status,
    )
    session.add(art)
    await session.commit()
    await session.refresh(art)
    return art


# ---------------------------------------------------------------------------
# Public: GET /graph
# ---------------------------------------------------------------------------

class TestGetGraph:
    async def test_empty_when_no_published_articles(self, client: AsyncClient):
        r = await client.get("/graph")
        assert r.status_code == 200
        data = r.json()
        assert data["nodes"] == []
        assert data["edges"] == []

    async def test_excludes_draft_articles(
        self, client: AsyncClient, db_session: AsyncSession, sf_chapter
    ):
        art = await _seed_article(db_session, sf_chapter.id, ArticleStatus.draft)
        await _seed_article_node(db_session, art.id, sf_chapter.id)

        r = await client.get("/graph")
        assert r.status_code == 200
        assert r.json()["nodes"] == []

    async def test_includes_published_article_and_connected_concepts(
        self, client: AsyncClient, db_session: AsyncSession, sf_chapter
    ):
        art = await _seed_article(db_session, sf_chapter.id, ArticleStatus.published)
        art_node = await _seed_article_node(db_session, art.id, sf_chapter.id)
        concept = await _seed_concept_node(db_session, "Democracy")
        await _seed_edge(db_session, art_node.id, concept.id, "article_discusses")

        r = await client.get("/graph")
        assert r.status_code == 200
        data = r.json()
        node_ids = {n["id"] for n in data["nodes"]}
        assert art_node.id in node_ids
        assert concept.id in node_ids
        assert len(data["edges"]) == 1
        assert data["edges"][0]["edge_type"] == "article_discusses"


# ---------------------------------------------------------------------------
# Public: GET /graph/nodes/{id}
# ---------------------------------------------------------------------------

class TestGetNodeDetail:
    async def test_404_for_unknown_node(self, client: AsyncClient):
        r = await client.get("/graph/nodes/does-not-exist")
        assert r.status_code == 404

    async def test_returns_node_detail(
        self, client: AsyncClient, db_session: AsyncSession, sf_chapter
    ):
        art = await _seed_article(db_session, sf_chapter.id, ArticleStatus.published)
        art_node = await _seed_article_node(db_session, art.id, sf_chapter.id)
        concept = await _seed_concept_node(db_session, "AI")
        await _seed_edge(db_session, art_node.id, concept.id, "article_discusses")

        r = await client.get(f"/graph/nodes/{concept.id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == concept.id
        assert data["label"] == "AI"
        assert any(n["id"] == art_node.id for n in data["neighbors"])

    async def test_linked_articles_only_published(
        self, client: AsyncClient, db_session: AsyncSession, sf_chapter
    ):
        # Draft article — should NOT appear in linked_articles
        draft = await _seed_article(db_session, sf_chapter.id, ArticleStatus.draft)
        draft_node = await _seed_article_node(db_session, draft.id, sf_chapter.id)
        concept = await _seed_concept_node(db_session, "Privacy")
        await _seed_edge(db_session, draft_node.id, concept.id, "article_discusses")

        r = await client.get(f"/graph/nodes/{concept.id}")
        assert r.status_code == 200
        assert r.json()["linked_articles"] == []

    async def test_returns_children(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        parent = await _seed_concept_node(db_session, "Politics")
        child = GraphNode(type="concept", label="Electoral Reform", parent_id=parent.id)
        db_session.add(child)
        await db_session.commit()
        await db_session.refresh(child)

        r = await client.get(f"/graph/nodes/{parent.id}")
        assert r.status_code == 200
        child_ids = {c["id"] for c in r.json()["children"]}
        assert child.id in child_ids


# ---------------------------------------------------------------------------
# Admin: GET /admin/graph/nodes
# ---------------------------------------------------------------------------

class TestAdminGetGraph:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/graph/nodes")
        assert r.status_code == 401

    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.get("/admin/graph/nodes", headers=lead_headers)
        assert r.status_code == 403

    async def test_returns_all_nodes_including_drafts(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        admin_headers,
        sf_chapter,
    ):
        art = await _seed_article(db_session, sf_chapter.id, ArticleStatus.draft)
        art_node = await _seed_article_node(db_session, art.id, sf_chapter.id)
        concept = await _seed_concept_node(db_session, "AI")

        r = await client.get("/admin/graph/nodes", headers=admin_headers)
        assert r.status_code == 200
        node_ids = {n["id"] for n in r.json()["nodes"]}
        assert art_node.id in node_ids
        assert concept.id in node_ids


# ---------------------------------------------------------------------------
# Admin: GET /admin/graph/merge-candidates
# ---------------------------------------------------------------------------

class TestMergeCandidates:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/graph/merge-candidates")
        assert r.status_code == 401

    async def test_returns_pending_candidates(
        self, client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        n1 = await _seed_concept_node(db_session, "AI Safety")
        n2 = await _seed_concept_node(db_session, "AI Alignment")
        mc = GraphMergeCandidate(
            node_a_id=n1.id, node_b_id=n2.id, similarity=0.88
        )
        db_session.add(mc)
        await db_session.commit()

        r = await client.get("/admin/graph/merge-candidates", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["similarity"] == pytest.approx(0.88)
        assert data[0]["node_a"]["label"] == "AI Safety"

    async def test_filters_by_status(
        self, client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        n1 = await _seed_concept_node(db_session, "X")
        n2 = await _seed_concept_node(db_session, "Y")
        mc = GraphMergeCandidate(
            node_a_id=n1.id, node_b_id=n2.id, similarity=0.75, status="merged"
        )
        db_session.add(mc)
        await db_session.commit()

        # Default filter = pending → should be empty
        r = await client.get("/admin/graph/merge-candidates", headers=admin_headers)
        assert r.json() == []

        # Explicit merged filter → should return one
        r = await client.get(
            "/admin/graph/merge-candidates?status=merged", headers=admin_headers
        )
        assert len(r.json()) == 1


# ---------------------------------------------------------------------------
# Admin: PATCH /admin/graph/nodes/{id}
# ---------------------------------------------------------------------------

class TestEditNode:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.patch("/admin/graph/nodes/fake-id", json={"label": "New"})
        assert r.status_code == 401

    async def test_404_for_missing_node(self, client: AsyncClient, admin_headers):
        r = await client.patch(
            "/admin/graph/nodes/does-not-exist",
            json={"label": "New"},
            headers=admin_headers,
        )
        assert r.status_code == 404

    async def test_updates_label_and_description(
        self, client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        concept = await _seed_concept_node(db_session, "Old Label")

        r = await client.patch(
            f"/admin/graph/nodes/{concept.id}",
            json={"label": "New Label", "description": "Updated desc"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["label"] == "New Label"
        assert data["description"] == "Updated desc"


# ---------------------------------------------------------------------------
# Admin: GET /admin/graph/backfill/status
# ---------------------------------------------------------------------------

class TestBackfillStatus:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/graph/backfill/status")
        assert r.status_code == 401

    async def test_returns_status(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/graph/backfill/status", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "processed" in data
        assert "total" in data
        assert "complete" in data
