"""Admin-managed system settings + key/model resolution.

System settings live in the ``SystemSetting`` table (Fernet-encrypted). This module is
the single decryption path for them and the single place that resolves provider API keys
and the processing model across all tiers:

    per-user UserAPIKey  →  admin SystemSetting  →  env var  →  (key: '' / model: default)

Keeping resolution here means the job pipeline (``processor.py``) and the graph paths
(``api/admin.py`` post-job ingestion, ``api/graph.py``) all fall back identically.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_key, encrypt_key
from app.models.api_key import APIKeyProvider, UserAPIKey
from app.models.system_setting import SystemSetting

# ── Admin-managed setting keys ────────────────────────────────────────────────
ASSEMBLYAI_API_KEY = "assemblyai_api_key"
GOOGLE_API_KEY = "google_api_key"
ARTICLE_LLM_MODEL = "article_llm_model"

_PROVIDER_SETTING_KEY = {
    APIKeyProvider.assemblyai: ASSEMBLYAI_API_KEY,
    APIKeyProvider.google: GOOGLE_API_KEY,
}


# ── Generic get/set ───────────────────────────────────────────────────────────

async def get_setting(db: AsyncSession, key: str) -> str | None:
    """Return the decrypted value for `key`, or None if unset."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    s = result.scalar_one_or_none()
    if not s:
        return None
    return decrypt_key(s.encrypted_value, settings.SECRET_KEY)


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    """Upsert `key` with an encrypted `value` and commit."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    existing = result.scalar_one_or_none()
    encrypted = encrypt_key(value, settings.SECRET_KEY)
    if existing:
        existing.encrypted_value = encrypted
    else:
        db.add(SystemSetting(key=key, encrypted_value=encrypted))
    await db.commit()


# ── Resolution ────────────────────────────────────────────────────────────────

def _env_key_for(provider: APIKeyProvider) -> str:
    if provider == APIKeyProvider.assemblyai:
        return settings.ASSEMBLYAI_API_KEY
    if provider == APIKeyProvider.google:
        return settings.GOOGLE_API_KEY
    return ""


async def resolve_provider_key(
    db: AsyncSession, provider: APIKeyProvider, user_id: str | None = None
) -> str:
    """Resolve a provider API key across all tiers.

    Order: per-user key (only if `user_id` given) → admin system setting → env var.
    Returns '' when no tier has it set; callers decide whether that is an error.
    """
    if user_id is not None:
        result = await db.execute(
            select(UserAPIKey).where(
                UserAPIKey.user_id == user_id,
                UserAPIKey.provider == provider,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            return decrypt_key(row.encrypted_key, settings.SECRET_KEY)

    setting_key = _PROVIDER_SETTING_KEY.get(provider)
    if setting_key:
        value = await get_setting(db, setting_key)
        if value:
            return value

    return _env_key_for(provider)


async def resolve_model(db: AsyncSession) -> tuple[str, str]:
    """Resolve the article-generation model.

    Order: admin system setting → env/config (`ARTICLE_LLM_MODEL`) → SocraticAI default.
    Returns ``(model, source)`` where source is ``"setting"``, ``"env"`` or ``"default"``.
    """
    value = await get_setting(db, ARTICLE_LLM_MODEL)
    if value:
        return value, "setting"
    if settings.ARTICLE_LLM_MODEL:
        return settings.ARTICLE_LLM_MODEL, "env"
    from socraticai.config import DEFAULT_LLM_MODEL

    return DEFAULT_LLM_MODEL, "default"
