"""Tiered resolution of provider keys and the processing model."""
from app.core.config import settings
from app.core.encryption import encrypt_key
from app.models.api_key import APIKeyProvider, UserAPIKey
from app.services.key_verification import verify_assemblyai_key, verify_model
from app.services.system_settings import (
    ARTICLE_LLM_MODEL,
    GOOGLE_API_KEY,
    get_setting,
    resolve_model,
    resolve_provider_key,
    set_setting,
)


async def test_set_get_roundtrip(db_session):
    await set_setting(db_session, "some_key", "some_value")
    assert await get_setting(db_session, "some_key") == "some_value"
    assert await get_setting(db_session, "missing") is None


async def test_resolve_key_prefers_user_over_system_and_env(db_session, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "env-key")
    await set_setting(db_session, GOOGLE_API_KEY, "system-key")
    db_session.add(
        UserAPIKey(
            user_id="u1",
            provider=APIKeyProvider.google,
            encrypted_key=encrypt_key("user-key", settings.SECRET_KEY),
        )
    )
    await db_session.commit()
    got = await resolve_provider_key(db_session, APIKeyProvider.google, user_id="u1")
    assert got == "user-key"


async def test_resolve_key_falls_back_to_system_setting(db_session, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "env-key")
    await set_setting(db_session, GOOGLE_API_KEY, "system-key")
    got = await resolve_provider_key(db_session, APIKeyProvider.google, user_id="nobody")
    assert got == "system-key"


async def test_resolve_key_falls_back_to_env(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "env-asm")
    got = await resolve_provider_key(db_session, APIKeyProvider.assemblyai)
    assert got == "env-asm"


async def test_resolve_key_empty_when_nothing_set(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
    got = await resolve_provider_key(db_session, APIKeyProvider.assemblyai)
    assert got == ""


async def test_resolve_model_setting_wins(db_session):
    await set_setting(db_session, ARTICLE_LLM_MODEL, "gemini-2.5-pro")
    model, source = await resolve_model(db_session)
    assert model == "gemini-2.5-pro"
    assert source == "setting"


async def test_resolve_model_env_when_no_setting(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ARTICLE_LLM_MODEL", "gemini-9-test")
    model, source = await resolve_model(db_session)
    assert model == "gemini-9-test"
    assert source == "env"


# ── Verification guard branches (no network) ──────────────────────────────────

def test_verify_assemblyai_empty_key():
    ok, _ = verify_assemblyai_key("")
    assert ok is False


def test_verify_model_requires_google_key():
    ok, message = verify_model("gemini-3.1-flash-lite", "")
    assert ok is False
    assert "Google API key" in message


def test_verify_model_requires_model():
    ok, _ = verify_model("", "some-google-key")
    assert ok is False
