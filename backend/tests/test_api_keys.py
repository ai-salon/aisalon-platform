"""Tests for /admin/api-keys endpoints."""
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.fixture(autouse=True)
def clear_system_keys(monkeypatch):
    """Isolate tests from the developer shell env."""
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "")


def _by_provider(entries: list[dict]) -> dict[str, dict]:
    return {e["provider"]: e for e in entries}


class TestListApiKeys:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/api-keys")
        assert r.status_code == 401

    async def test_returns_all_providers_with_flags(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/api-keys", headers=admin_headers)
        assert r.status_code == 200
        entries = r.json()
        by = _by_provider(entries)
        assert set(by.keys()) == {"assemblyai", "google"}
        for e in entries:
            assert e["has_key"] is False
            assert e["user_has_key"] is False
            assert e["system_has_key"] is False

    async def test_user_key_sets_user_has_key(self, client: AsyncClient, admin_headers):
        await client.post("/admin/api-keys",
                          json={"provider": "assemblyai", "key": "test-key-123"},
                          headers=admin_headers)
        r = await client.get("/admin/api-keys", headers=admin_headers)
        by = _by_provider(r.json())
        assert by["assemblyai"]["user_has_key"] is True
        assert by["assemblyai"]["has_key"] is True
        assert by["google"]["user_has_key"] is False
        assert by["google"]["has_key"] is False

    async def test_system_env_var_sets_system_has_key(
        self, client: AsyncClient, admin_headers, monkeypatch
    ):
        monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "system-asm-key")
        r = await client.get("/admin/api-keys", headers=admin_headers)
        by = _by_provider(r.json())
        assert by["assemblyai"]["system_has_key"] is True
        assert by["assemblyai"]["user_has_key"] is False
        assert by["assemblyai"]["has_key"] is True
        assert by["google"]["system_has_key"] is False
        assert by["google"]["has_key"] is False


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
        by = _by_provider(r.json())
        # Still exactly one assemblyai entry, with user_has_key true
        assert by["assemblyai"]["user_has_key"] is True

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
        by = _by_provider(r2.json())
        assert by["assemblyai"]["user_has_key"] is False
        assert by["assemblyai"]["has_key"] is False

    async def test_delete_nonexistent_is_404(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/api-keys/assemblyai", headers=admin_headers)
        assert r.status_code == 404
