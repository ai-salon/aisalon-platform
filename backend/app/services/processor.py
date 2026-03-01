"""Audio processing pipeline: transcribe → generate article."""
from abc import ABC, abstractmethod

import anthropic as _anthropic
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_key
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.services.assemblyai import transcribe


SOCRATIC_PROMPT = (
    "You are a writer for the Ai Salon. Given this transcript of a salon discussion, "
    "write a rich Markdown article capturing the key questions raised, range of perspectives, "
    "and insights that emerged. The first line should be a # Heading with the article title. "
    "Structure the rest with ## headings for major themes."
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
    """Full pipeline: AssemblyAI transcription → Claude article generation."""

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

        # 3. Generate article with Claude
        anthropic_key = await self._get_key(db, user_id, APIKeyProvider.anthropic)
        client = _anthropic.AsyncAnthropic(api_key=anthropic_key)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": f"{SOCRATIC_PROMPT}\n\n---\n\n{transcript_text}",
                }
            ],
        )
        content_md = message.content[0].text  # type: ignore[union-attr]

        # Extract title from first # heading
        lines = content_md.strip().splitlines()
        title = "Untitled"
        body_lines = lines
        if lines and lines[0].startswith("# "):
            title = lines[0][2:].strip()
            body_lines = lines[1:]

        return {"title": title, "content_md": "\n".join(body_lines).strip()}
