"""Tests for /admin/api-keys endpoints."""
import pytest
from httpx import AsyncClient


class TestListApiKeys:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/api-keys")
        assert r.status_code == 401

    async def test_empty_list(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/api-keys", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    async def test_shape_after_set(self, client: AsyncClient, admin_headers):
        await client.post("/admin/api-keys",
                          json={"provider": "assemblyai", "key": "test-key-123"},
                          headers=admin_headers)
        r = await client.get("/admin/api-keys", headers=admin_headers)
        assert r.status_code == 200
        entry = r.json()[0]
        assert entry["provider"] == "assemblyai"
        assert "has_key" in entry
        assert entry["has_key"] is True


class TestSetApiKey:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post("/admin/api-keys", json={"provider": "assemblyai", "key": "k"})
        assert r.status_code == 401

    async def test_set_key(self, client: AsyncClient, admin_headers):
        r = await client.post("/admin/api-keys",
                              json={"provider": "assemblyai", "key": "asm-abc123"},
                              headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["provider"] == "assemblyai"

    async def test_key_value_not_exposed(self, client: AsyncClient, admin_headers):
        await client.post("/admin/api-keys",
                          json={"provider": "anthropic", "key": "sk-secret"},
                          headers=admin_headers)
        r = await client.get("/admin/api-keys", headers=admin_headers)
        body = str(r.json())
        assert "sk-secret" not in body

    async def test_update_overwrites(self, client: AsyncClient, admin_headers):
        await client.post("/admin/api-keys",
                          json={"provider": "assemblyai", "key": "v1"},
                          headers=admin_headers)
        await client.post("/admin/api-keys",
                          json={"provider": "assemblyai", "key": "v2"},
                          headers=admin_headers)
        r = await client.get("/admin/api-keys", headers=admin_headers)
        providers = [e["provider"] for e in r.json()]
        assert providers.count("assemblyai") == 1

    async def test_invalid_provider(self, client: AsyncClient, admin_headers):
        r = await client.post("/admin/api-keys",
                              json={"provider": "unknown_provider", "key": "k"},
                              headers=admin_headers)
        assert r.status_code == 422


class TestDeleteApiKey:
    async def test_delete_key(self, client: AsyncClient, admin_headers):
        await client.post("/admin/api-keys",
                          json={"provider": "assemblyai", "key": "k"},
                          headers=admin_headers)
        r = await client.delete("/admin/api-keys/assemblyai", headers=admin_headers)
        assert r.status_code == 204
        r2 = await client.get("/admin/api-keys", headers=admin_headers)
        assert r2.json() == []

    async def test_delete_nonexistent_is_404(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/api-keys/assemblyai", headers=admin_headers)
        assert r.status_code == 404
