"""Admin processing-config endpoints: GET status + POST live verification."""
from app.core.config import settings
from app.services import key_verification


async def test_processing_config_requires_superadmin(client, host_headers):
    r = await client.get("/admin/processing-config", headers=host_headers)
    assert r.status_code == 403


async def test_processing_config_defaults(client, admin_headers, monkeypatch):
    # Pin env-var fallbacks to empty so we exercise the true "nothing set" path
    # regardless of what this machine's .env happens to contain.
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "")
    r = await client.get("/admin/processing-config", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["assemblyai_set"] is False
    assert data["google_set"] is False
    assert data["model"]
    assert data["model_source"] in ("env", "default")


async def test_processing_config_reflects_saved_settings(client, admin_headers):
    for key, value in (
        ("assemblyai_api_key", "asm-key"),
        ("google_api_key", "goog-key"),
        ("article_llm_model", "gemini-2.5-pro"),
    ):
        await client.post(
            "/admin/system-settings", headers=admin_headers, json={"key": key, "value": value}
        )
    r = await client.get("/admin/processing-config", headers=admin_headers)
    data = r.json()
    assert data["assemblyai_set"] is True
    assert data["google_set"] is True
    assert data["model"] == "gemini-2.5-pro"
    assert data["model_source"] == "setting"


async def test_processing_test_requires_superadmin(client, host_headers):
    r = await client.post(
        "/admin/processing/test",
        headers=host_headers,
        json={"target": "assemblyai", "value": "x"},
    )
    assert r.status_code == 403


async def test_processing_test_assemblyai_ok(client, admin_headers, monkeypatch):
    monkeypatch.setattr(
        key_verification, "verify_assemblyai_key", lambda key: (True, "AssemblyAI key is valid.")
    )
    r = await client.post(
        "/admin/processing/test",
        headers=admin_headers,
        json={"target": "assemblyai", "value": "secret"},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "message": "AssemblyAI key is valid."}


async def test_processing_test_model_uses_system_google_key(client, admin_headers, monkeypatch):
    captured = {}

    def fake_verify_model(model, google_key):
        captured["model"] = model
        captured["google_key"] = google_key
        return False, "Unsupported model"

    monkeypatch.setattr(key_verification, "verify_model", fake_verify_model)
    await client.post(
        "/admin/system-settings",
        headers=admin_headers,
        json={"key": "google_api_key", "value": "goog-from-setting"},
    )
    r = await client.post(
        "/admin/processing/test",
        headers=admin_headers,
        json={"target": "model", "value": "made-up-model"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is False
    assert captured == {"model": "made-up-model", "google_key": "goog-from-setting"}


async def test_processing_test_unknown_target(client, admin_headers):
    r = await client.post(
        "/admin/processing/test",
        headers=admin_headers,
        json={"target": "nope", "value": "x"},
    )
    assert r.status_code == 422
