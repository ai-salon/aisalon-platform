"""Tests for profile photo upload."""
import io
from httpx import AsyncClient


# 1×1 JPEG (smallest valid JPEG)
JPEG_BYTES = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb0043000806060706"
    "0506080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c"
    "20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432"
    "ffc0000b080001000101011100ffc4001f0000010501010101010100000000"
    "00000000010203040506070809000affda0008010100003f00d2cf20ffd9"
)


async def test_upload_profile_photo_requires_auth(client: AsyncClient):
    files = {"file": ("photo.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")}
    r = await client.post("/profile/photo", files=files)
    assert r.status_code in (401, 403)


async def test_upload_profile_photo_accepts_jpeg(client: AsyncClient, host_headers):
    files = {"file": ("photo.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 200
    body = r.json()
    assert "url" in body
    assert body["url"].startswith("/uploads/")


async def test_upload_profile_photo_rejects_non_image(client: AsyncClient, host_headers):
    files = {"file": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 400


async def test_upload_profile_photo_rejects_oversize(client: AsyncClient, host_headers):
    big = JPEG_BYTES + b"\x00" * (5 * 1024 * 1024 + 1)
    files = {"file": ("big.jpg", io.BytesIO(big), "image/jpeg")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 413
