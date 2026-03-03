"""Social media sharing via Late.dev + AI copy generation."""
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.encryption import decrypt_key
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


async def generate_social_copy(
    title: str,
    content: str,
    url: str,
    db: AsyncSession,
) -> str:
    """Generate LinkedIn post copy from article content using Google Gemini."""
    # Get google API key from system settings
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "google_api_key")
    )
    setting = result.scalar_one_or_none()

    if not setting:
        # Fallback: simple template
        snippet = content[:300].replace("\n", " ").strip()
        link_text = f"\n\nRead more: {url}" if url else ""
        return f"{title}\n\n{snippet}...{link_text}"

    api_key = decrypt_key(setting.encrypted_value, settings.SECRET_KEY)

    from google import genai

    client = genai.Client(api_key=api_key)
    prompt = (
        "Write a LinkedIn post promoting this article. "
        "Keep it under 200 words, professional but engaging. "
        "Include relevant hashtags.\n\n"
        f"Title: {title}\n\n"
        f"Article content:\n{content[:2000]}\n\n"
    )
    if url:
        prompt += f"Link to include: {url}\n"

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text or ""


class LatePublisher:
    """Post to social media via Late.dev API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.late.dev/v1"

    async def post(self, content: str, account_id: str) -> str:
        """Post content via Late.dev. Returns external post ID."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/posts",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "content": content,
                    "platforms": [{"accountId": account_id}],
                    "publishNow": True,
                },
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
            return str(data.get("id", ""))
