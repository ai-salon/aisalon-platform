import uuid
import aiofiles
from pathlib import Path

from app.core.config import settings


async def save_upload(filename: str, data: bytes) -> str:
    """Save uploaded bytes to UPLOAD_DIR; return storage key."""
    upload_dir = Path(settings.UPLOAD_DIR)
    key = f"{uuid.uuid4()}/{filename}"
    dest = upload_dir / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(dest, "wb") as f:
        await f.write(data)
    return key
