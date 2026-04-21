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

_executor = ThreadPoolExecutor(max_workers=1)


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

        def run_generator() -> tuple[str, str]:
            import os
            import shutil
            import tempfile

            import assemblyai as aai
            import socraticai.config as sc_config
            import socraticai.core.utils as sc_utils
            from socraticai.content.article.article_generator import ArticleGenerator

            # Redirect SocraticAI to a writable scratch dir, not site-packages
            work_dir = tempfile.mkdtemp(prefix="socratic_")
            sc_config.DATA_DIRECTORY = work_dir
            sc_utils.DATA_DIRECTORY = work_dir

            # Create the subdirectories SocraticAI expects under DATA_DIRECTORY
            for subdir in ("inputs", "transcripts", "processed", "outputs/articles"):
                Path(work_dir, subdir).mkdir(parents=True, exist_ok=True)

            # ArticleGenerator.__init__ calls LLMChain(model=...) immediately, so the
            # Google API key must be in the env before construction — not just before .generate()
            prev_google = os.environ.get("GOOGLE_API_KEY")
            os.environ["GOOGLE_API_KEY"] = google_key

            try:
                aai.settings.api_key = assemblyai_key
                # Pass model explicitly so the constructor doesn't try to init
                # a default Anthropic chain (which would fail with AuthenticationError)
                generator = ArticleGenerator(model="gemini-3-flash-preview")
                article_path, meta_path = generator.generate(input_paths=audio_path, anonymize=True)
                article_md = Path(article_path).read_text()
                # Read anonymized transcript before the work dir is cleaned up
                anon_files = list(Path(work_dir, "processed").glob("*_anon.txt"))
                anon_transcript = anon_files[0].read_text() if anon_files else ""
                # Read meta.json for graph ingestion (None if file missing)
                import json as _json
                meta: dict = {}
                if meta_path and Path(meta_path).exists():
                    try:
                        meta = _json.loads(Path(meta_path).read_text())
                    except Exception:
                        pass
                return article_md, anon_transcript, meta
            finally:
                if prev_google is None:
                    os.environ.pop("GOOGLE_API_KEY", None)
                else:
                    os.environ["GOOGLE_API_KEY"] = prev_google
                shutil.rmtree(work_dir, ignore_errors=True)

        article_md, anon_transcript, meta = await loop.run_in_executor(_executor, run_generator)

        # Extract title from the first meaningful heading in the article body.
        # SocraticAI formats the file as: editor note → article body → # Notes from
        # the Conversation → # Open Questions → # Pull Quotes. The article body may
        # use ## headings rather than a # title, so we scan for any heading that isn't
        # one of the known analysis section markers.
        _SECTION_HEADERS = {"Notes from the Conversation", "Open Questions", "Pull Quotes", "Moments"}
        title = "Untitled"
        for line in article_md.strip().splitlines():
            if line.startswith("#"):
                candidate = line.lstrip("#").strip()
                if candidate and candidate not in _SECTION_HEADERS:
                    title = candidate
                    break

        return {
            "title": title,
            "content_md": article_md.strip(),
            "anonymized_transcript": anon_transcript,
            "meta": meta,
        }
