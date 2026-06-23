"""Unit tests for SocraticProcessor.process_from_transcript (regenerate path).

Verifies the regenerate path reuses the stored transcript: it must feed the generator
a TEXT file with anonymize=False, preserve the source filename (so header date parsing
works), pass the transcript straight through as the article's anonymized_transcript, and
NOT require an AssemblyAI key.
"""
import json
import tempfile
from pathlib import Path

import pytest

from app.core.config import settings
from app.models.user import User, UserRole
from app.services.processor import SocraticProcessor


class _FakeGenerator:
    """Stand-in for SocraticAI's ArticleGenerator. Records the generate() call."""
    calls: list = []

    def __init__(self, model=None, **kwargs):
        self.model = model

    def generate(self, input_paths, anonymize=True, **kwargs):
        type(self).calls.append({"input_paths": input_paths, "anonymize": anonymize})
        out_dir = Path(tempfile.mkdtemp())
        art = out_dir / "out.md"
        art.write_text("# Regenerated Title\n\nFresh body from the same transcript.")
        meta = out_dir / "out_meta.json"
        meta.write_text(json.dumps({"model_used": self.model}))
        return art, meta


async def _add_user(db_session) -> User:
    user = User(email="regen@test.com", hashed_password="x",
                role=UserRole.host, is_active=True)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def patched_generator(monkeypatch):
    _FakeGenerator.calls = []
    import socraticai.content.article.article_generator as agmod
    monkeypatch.setattr(agmod, "ArticleGenerator", _FakeGenerator)
    return _FakeGenerator


async def test_process_from_transcript_passthrough(db_session, monkeypatch, patched_generator):
    # Google key available via system fallback; AssemblyAI deliberately left unset.
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "g-key")
    monkeypatch.setattr(settings, "ASSEMBLYAI_API_KEY", "")
    user = await _add_user(db_session)
    transcript = "This is the stored anonymized transcript. " * 50

    proc = SocraticProcessor()
    result = await proc.process_from_transcript(
        transcript_text=transcript,
        source_filename="2025-06-22-salon.m4a",
        chapter_id="chap-1",
        user_id=user.id,
        db=db_session,
    )

    assert result["title"] == "Regenerated Title"
    assert result["content_md"].startswith("# Regenerated Title")
    # Transcript passes straight through (already anonymized; no re-transcription).
    assert result["anonymized_transcript"] == transcript

    call = patched_generator.calls[0]
    assert call["anonymize"] is False
    assert call["input_paths"].endswith(".txt")
    # Source filename preserved so the article header can parse the event date.
    assert "2025-06-22" in call["input_paths"]


async def test_process_from_transcript_uses_configured_model(
    db_session, monkeypatch, patched_generator
):
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "g-key")
    monkeypatch.setattr(settings, "ARTICLE_LLM_MODEL", "gemini-test-model")
    user = await _add_user(db_session)

    proc = SocraticProcessor()
    result = await proc.process_from_transcript(
        transcript_text="x" * 2000, source_filename="t.m4a",
        chapter_id="c", user_id=user.id, db=db_session,
    )
    # meta carries the model the generator was constructed with
    assert result["meta"]["model_used"] == "gemini-test-model"
