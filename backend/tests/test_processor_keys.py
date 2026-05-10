"""Tests for SocraticProcessor key resolution (user → system env var → error)."""
import pytest

from app.core.config import settings
from app.core.encryption import encrypt_key
from app.models.api_key import APIKeyProvider, UserAPIKey
from app.models.user import User, UserRole
from app.services.processor import SocraticProcessor, system_key_for


@pytest.fixture(autouse=True)
def clear_system_keys(monkeypatch):
    """Isolate tests from the developer shell env."""
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "")


@pytest.fixture
def processor() -> SocraticProcessor:
    return SocraticProcessor()


async def _add_user(db_session) -> User:
    user = User(
        email="proc-test@example.com",
        hashed_password="x",
        role=UserRole.host,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestKeyResolution:
    async def test_user_key_takes_precedence(self, db_session, monkeypatch, processor):
        user = await _add_user(db_session)
        encrypted = encrypt_key("user-key", settings.SECRET_KEY)
        db_session.add(UserAPIKey(
            user_id=user.id, provider=APIKeyProvider.assemblyai, encrypted_key=encrypted,
        ))
        await db_session.commit()
        monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "system-key")

        key = await processor._get_key(db_session, user.id, APIKeyProvider.assemblyai)
        assert key == "user-key"

    async def test_falls_back_to_env_var(self, db_session, monkeypatch, processor):
        user = await _add_user(db_session)
        monkeypatch.setattr(settings, "GOOGLE_API_KEY", "system-google-key")

        key = await processor._get_key(db_session, user.id, APIKeyProvider.google)
        assert key == "system-google-key"

    async def test_raises_when_neither_set(self, db_session, monkeypatch, processor):
        user = await _add_user(db_session)
        monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")

        with pytest.raises(ValueError, match="Assemblyai API key not configured"):
            await processor._get_key(db_session, user.id, APIKeyProvider.assemblyai)


class TestSystemKeyHelper:
    def test_returns_assemblyai_env(self, monkeypatch):
        monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "abc")
        assert system_key_for(APIKeyProvider.assemblyai) == "abc"

    def test_returns_google_env(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_API_KEY", "xyz")
        assert system_key_for(APIKeyProvider.google) == "xyz"

    def test_returns_empty_when_unset(self, monkeypatch):
        monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
        monkeypatch.setattr(settings, "GOOGLE_API_KEY", "")
        assert system_key_for(APIKeyProvider.assemblyai) == ""
        assert system_key_for(APIKeyProvider.google) == ""
