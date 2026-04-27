"""Tests for feature flag endpoints."""
from httpx import AsyncClient


class TestPublicFeatureFlags:
    async def test_public_no_auth(self, client: AsyncClient):
        r = await client.get("/public-feature-flags")
        assert r.status_code == 200
        body = r.json()
        assert "insights_enabled" in body
        assert body["insights_enabled"] is False  # default

    async def test_reflects_admin_changes(self, client: AsyncClient, admin_headers):
        await client.put(
            "/admin/feature-flags/insights_enabled",
            json={"value": True},
            headers=admin_headers,
        )
        r = await client.get("/public-feature-flags")
        assert r.status_code == 200
        assert r.json()["insights_enabled"] is True


class TestAdminListFeatureFlags:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/feature-flags")
        assert r.status_code == 401

    async def test_lead_forbidden(self, client: AsyncClient, lead_headers):
        r = await client.get("/admin/feature-flags", headers=lead_headers)
        assert r.status_code == 403

    async def test_host_forbidden(self, client: AsyncClient, host_headers):
        r = await client.get("/admin/feature-flags", headers=host_headers)
        assert r.status_code == 403

    async def test_lists_with_defaults(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/feature-flags", headers=admin_headers)
        assert r.status_code == 200
        flags = {f["name"]: f for f in r.json()}
        assert "insights_enabled" in flags
        assert flags["insights_enabled"]["value"] is False
        assert flags["insights_enabled"]["description"]


class TestAdminSetFeatureFlag:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.put(
            "/admin/feature-flags/insights_enabled", json={"value": True}
        )
        assert r.status_code == 401

    async def test_lead_forbidden(self, client: AsyncClient, lead_headers):
        r = await client.put(
            "/admin/feature-flags/insights_enabled",
            json={"value": True},
            headers=lead_headers,
        )
        assert r.status_code == 403

    async def test_unknown_flag_rejected(self, client: AsyncClient, admin_headers):
        r = await client.put(
            "/admin/feature-flags/does_not_exist",
            json={"value": True},
            headers=admin_headers,
        )
        assert r.status_code == 404

    async def test_round_trip(self, client: AsyncClient, admin_headers):
        r = await client.put(
            "/admin/feature-flags/insights_enabled",
            json={"value": True},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["value"] is True

        r2 = await client.get("/admin/feature-flags", headers=admin_headers)
        flags = {f["name"]: f for f in r2.json()}
        assert flags["insights_enabled"]["value"] is True

        # Toggle back off
        r3 = await client.put(
            "/admin/feature-flags/insights_enabled",
            json={"value": False},
            headers=admin_headers,
        )
        assert r3.status_code == 200
        assert r3.json()["value"] is False
