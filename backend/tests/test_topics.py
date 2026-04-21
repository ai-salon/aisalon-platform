"""Tests for topics API (public + admin)."""
import pytest
from httpx import AsyncClient

from app.models.topic import Topic


async def _create_topic(
    db_session, title="Test Topic", display_order=0, is_active=True
):
    topic = Topic(
        title=title,
        content="## Description\n\nA test topic.",
        is_active=is_active,
        display_order=display_order,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)
    return topic


async def test_list_topics_empty(client: AsyncClient):
    r = await client.get("/topics")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_topics_returns_active_only(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Active", is_active=True)
    await _create_topic(db_session, title="Inactive", is_active=False)
    r = await client.get("/topics")
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "Active" in titles
    assert "Inactive" not in titles


async def test_list_topics_ordered_by_display_order(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Second", display_order=2)
    await _create_topic(db_session, title="First", display_order=1)
    r = await client.get("/topics")
    titles = [t["title"] for t in r.json()]
    assert titles == ["First", "Second"]


async def test_list_topics_response_has_content_field(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Has Content")
    r = await client.get("/topics")
    assert r.status_code == 200
    topic = r.json()[0]
    assert "content" in topic
    assert "description" not in topic
    assert "opening_question" not in topic
    assert "prompts" not in topic


async def test_admin_list_topics_requires_auth(client: AsyncClient):
    r = await client.get("/admin/topics")
    assert r.status_code == 401


async def test_admin_list_topics_includes_inactive(
    client: AsyncClient, db_session, admin_headers
):
    await _create_topic(db_session, title="Active")
    await _create_topic(db_session, title="Inactive", is_active=False)
    r = await client.get("/admin/topics", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_admin_create_topic(client: AsyncClient, admin_headers):
    payload = {
        "title": "AI Ethics",
        "content": "## Description\n\nExploring ethical AI.",
    }
    r = await client.post("/admin/topics", json=payload, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["title"] == "AI Ethics"
    assert r.json()["content"] == "## Description\n\nExploring ethical AI."
    assert r.json()["is_active"] is True


async def test_admin_create_topic_requires_superadmin(
    client: AsyncClient, lead_headers
):
    payload = {"title": "Test", "content": "Test content."}
    r = await client.post("/admin/topics", json=payload, headers=lead_headers)
    assert r.status_code == 403


async def test_admin_update_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.put(
        f"/admin/topics/{topic.id}",
        json={"title": "Updated", "content": "Updated markdown."},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"
    assert r.json()["content"] == "Updated markdown."


async def test_admin_update_topic_not_found(client: AsyncClient, admin_headers):
    r = await client.put(
        "/admin/topics/fake-id",
        json={"title": "X", "content": "X"},
        headers=admin_headers,
    )
    assert r.status_code == 404


async def test_admin_delete_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=admin_headers)
    assert r.status_code == 204
    r2 = await client.get("/admin/topics", headers=admin_headers)
    deactivated = [t for t in r2.json() if t["id"] == topic.id]
    assert len(deactivated) == 1
    assert deactivated[0]["is_active"] is False


async def test_admin_delete_topic_requires_superadmin(
    client: AsyncClient, db_session, lead_headers
):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=lead_headers)
    assert r.status_code == 403
