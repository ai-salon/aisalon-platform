"""Audio processing pipeline: transcribe → generate article."""
from abc import ABC, abstractmethod

import asyncio
from google import genai
from google.genai import types as genai_types
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_key
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.services.assemblyai import transcribe


GEMINI_MODEL = "gemini-3-flash-preview"

SOCRATIC_PROMPT = (
    "You are a writer for the Ai Salon. Given this transcript of a salon discussion, "
    "write a rich Markdown article capturing the key questions raised, range of perspectives, "
    "and insights that emerged. The first line should be a # Heading with the article title. "
    "Structure the rest with ## headings for major themes."
)

ANONYMIZE_PROMPT = (
    "You are a privacy-focused editor. Given this conversation transcript, produce a fully anonymized version:\n"
    "- Replace every distinct speaker or named participant with a consistent label: Person A, Person B, Person C, etc.\n"
    "- Apply labels consistently throughout — the same person always gets the same label.\n"
    "- Remove or redact any other personally identifying details (full employer names used to identify someone, "
    "contact info, identifying locations beyond city-level).\n"
    "- Preserve the full content, structure, and flow of the conversation verbatim.\n"
    "Return only the anonymized transcript — no preamble or explanation."
)


class BaseProcessor(ABC):
    @abstractmethod
    async def process(
        self,
        storage_key: str,
        chapter_id: str,
        user_id: str,
        db: AsyncSession,
    ) -> dict:
        """Process an uploaded audio file; return article data dict."""
        ...


class SocraticProcessor(BaseProcessor):
    """Full pipeline: AssemblyAI transcription → Gemini article generation."""

    async def _get_key(self, db: AsyncSession, user_id: str, provider: APIKeyProvider) -> str:
        result = await db.execute(
            select(UserAPIKey).where(
                UserAPIKey.user_id == user_id,
                UserAPIKey.provider == provider,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(
                f"{provider.value.title()} API key not configured. Set it in Settings."
            )
        return decrypt_key(row.encrypted_key, settings.SECRET_KEY)

    async def process(
        self,
        storage_key: str,
        chapter_id: str,
        user_id: str,
        db: AsyncSession,
    ) -> dict:
        # 1. Read file
        audio_path = Path(settings.UPLOAD_DIR) / storage_key
        audio_bytes = audio_path.read_bytes()

        # 2. Transcribe
        assemblyai_key = await self._get_key(db, user_id, APIKeyProvider.assemblyai)
        transcript_text = await transcribe(audio_bytes, assemblyai_key)

        # 3. Generate article + anonymized transcript with Gemini (concurrent)
        google_key = await self._get_key(db, user_id, APIKeyProvider.google)
        client = genai.Client(api_key=google_key)

        async def _generate(prompt: str, max_tokens: int) -> str:
            config = genai_types.GenerateContentConfig(max_output_tokens=max_tokens)
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            return response.text

        article_text, anonymized_transcript = await asyncio.gather(
            _generate(f"{SOCRATIC_PROMPT}\n\n---\n\n{transcript_text}", 4096),
            _generate(f"{ANONYMIZE_PROMPT}\n\n---\n\n{transcript_text}", 8192),
        )

        # Extract title from first # heading
        lines = article_text.strip().splitlines()
        title = "Untitled"
        body_lines = lines
        if lines and lines[0].startswith("# "):
            title = lines[0][2:].strip()
            body_lines = lines[1:]

        return {
            "title": title,
            "content_md": "\n".join(body_lines).strip(),
            "anonymized_transcript": anonymized_transcript,
        }
