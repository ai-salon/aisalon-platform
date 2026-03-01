"""Async AssemblyAI REST client."""
import asyncio
import httpx

ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2"
POLL_INTERVAL = 5  # seconds
POLL_TIMEOUT = 3600  # seconds (1 hour)


async def transcribe(audio_bytes: bytes, api_key: str) -> str:
    """Upload audio to AssemblyAI, poll for completion, return transcript text."""
    headers = {"authorization": api_key}

    async with httpx.AsyncClient(timeout=60) as client:
        # 1. Upload the file
        upload_resp = await client.post(
            f"{ASSEMBLYAI_BASE}/upload",
            headers=headers,
            content=audio_bytes,
        )
        upload_resp.raise_for_status()
        upload_url = upload_resp.json()["upload_url"]

        # 2. Submit transcript request
        transcript_resp = await client.post(
            f"{ASSEMBLYAI_BASE}/transcript",
            headers={**headers, "content-type": "application/json"},
            json={"audio_url": upload_url},
        )
        transcript_resp.raise_for_status()
        transcript_id = transcript_resp.json()["id"]

    # 3. Poll for completion (new client per poll to avoid timeout issues)
    elapsed = 0
    while elapsed < POLL_TIMEOUT:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        async with httpx.AsyncClient(timeout=30) as client:
            status_resp = await client.get(
                f"{ASSEMBLYAI_BASE}/transcript/{transcript_id}",
                headers=headers,
            )
            status_resp.raise_for_status()
            data = status_resp.json()

        if data["status"] == "completed":
            return data.get("text") or ""
        if data["status"] == "error":
            raise RuntimeError(f"AssemblyAI error: {data.get('error')}")

    raise TimeoutError(f"AssemblyAI transcription timed out after {POLL_TIMEOUT}s")
