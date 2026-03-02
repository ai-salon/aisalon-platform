"""Audio processing pipeline — delegates to SocraticAI's ArticleGenerator.

Mirrors the CLI's article command:
  generator.generate(input_paths=file_path, anonymize=True)

Single file: pass storage_key → resolved to an absolute path.
Multi-file support is straightforward when needed: pass a list of paths to
ArticleGenerator.generate(input_paths=[...]).
"""
import asyncio
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_key
from app.models.api_key import UserAPIKey, APIKeyProvider

StepCallback = Callable[[str], Awaitable[None]]

_executor = ThreadPoolExecutor(max_workers=2)


class BaseProcessor(ABC):
    @abstractmethod
    async def process(
        self,
        storage_key: str,
        chapter_id: str,
        user_id: str,
        db: AsyncSession,
        on_step: StepCallback | None = None,
    ) -> dict:
        """Process an uploaded audio file; return article data dict."""
        ...


class SocraticProcessor(BaseProcessor):
    """Wraps ArticleGenerator.generate() exactly as the CLI does."""

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
        on_step: StepCallback | None = None,
    ) -> dict:
        async def _step(label: str) -> None:
            if on_step:
                await on_step(label)

        assemblyai_key = await self._get_key(db, user_id, APIKeyProvider.assemblyai)
        google_key = await self._get_key(db, user_id, APIKeyProvider.google)

        audio_path = str(Path(settings.UPLOAD_DIR) / storage_key)

        await _step("Generating article…")

        loop = asyncio.get_event_loop()

        def run_generator() -> str:
            import assemblyai as aai
            from socraticai.content.article.article_generator import ArticleGenerator
            from socraticai.core.llm import LLMChain
            from socraticai.core.utils import ensure_data_directories

            ensure_data_directories()

            # Inject API keys; use gemini-2.5-flash (Gemini model in the GitHub version)
            aai.settings.api_key = assemblyai_key
            generator = ArticleGenerator()
            generator.llm_chain = LLMChain(model="gemini-2.5-flash", api_key=google_key)

            # Identical to the CLI's _process_single_file
            article_path, _ = generator.generate(input_paths=audio_path, anonymize=True)
            return Path(article_path).read_text()

        article_md = await loop.run_in_executor(_executor, run_generator)

        # Find the first # heading (article title) — the file may start with
        # the editor's note block before the title heading
        title = "Untitled"
        body_lines = article_md.strip().splitlines()
        for i, line in enumerate(body_lines):
            if line.startswith("# "):
                title = line[2:].strip()
                body_lines = body_lines[i + 1:]
                break

        return {
            "title": title,
            "content_md": "\n".join(body_lines).strip(),
            "anonymized_transcript": "",
        }
