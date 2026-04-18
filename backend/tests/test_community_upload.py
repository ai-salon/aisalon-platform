"""Tests for community upload API (public upload + admin queue)."""
import io
import struct

from httpx import AsyncClient

from app.models.community_upload import CommunityUpload, UploadStatus
from app.models.topic import Topic


async def _create_topic(db_session):
    topic = Topic(
        title="Test Topic",
        description="desc",
        opening_question="question?",
        prompts=[],
        is_active=True,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)
    return topic


async def _create_upload(
    db_session, topic_id=None, upload_status=UploadStatus.pending, city="San Francisco"
):
    upload = CommunityUpload(
        name="Jane",
        email="jane@example.com",
        topic_id=topic_id,
        city=city,
        audio_path="community/test.wav",
        notes="Great discussion",
        status=upload_status,
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload


def _wav_header() -> bytes:
    sample_rate = 44100
    num_channels = 1
    bits_per_sample = 16
    data_size = 0
    header = b"RIFF"
    header += struct.pack("<I", 36 + data_size)
    header += b"WAVE"
    header += b"fmt "
    header += struct.pack("<I", 16)
    header += struct.pack("<H", 1)
    header += struct.pack("<H", num_channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", sample_rate * num_channels * bits_per_sample // 8)
    header += struct.pack("<H", num_channels * bits_per_sample // 8)
    header += struct.pack("<H", bits_per_sample)
    header += b"data"
    header += struct.pack("<I", data_size)
    return header


async def test_upload_audio(client: AsyncClient, db_session, tmp_path):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={
            "name": "Test User",
            "email": "test@example.com",
            "topic_id": topic.id,
            "city": "San Francisco",
            "notes": "Good convo",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert "id" in body
    assert "audio_path" not in body  # not exposed in public response


async def test_upload_requires_city(client: AsyncClient, db_session):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"topic_id": topic.id},  # city missing
    )
    assert r.status_code == 422


async def test_upload_requires_topic(client: AsyncClient, db_session):
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "Berlin"},  # no topic_id, no topic_text
    )
    assert r.status_code == 422


async def test_upload_with_topic_text(client: AsyncClient, db_session):
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "London", "topic_text": "The future of work"},
    )
    assert r.status_code == 201


async def test_upload_honeypot_silently_accepted(client: AsyncClient, db_session):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "Bot City", "topic_id": topic.id, "website": "http://spam.com"},
    )
    # Bots get a fake 200, not a 201 or an error
    assert r.status_code == 200


async def test_upload_rejects_non_audio(client: AsyncClient, db_session):
    r = await client.post(
        "/community/upload",
        files={"file": ("document.txt", io.BytesIO(b"hello world"), "text/plain")},
        data={"city": "London", "topic_text": "Some topic"},
    )
    assert r.status_code == 400


async def test_admin_list_uploads_requires_auth(client: AsyncClient):
    r = await client.get("/admin/community-uploads")
    assert r.status_code == 401


async def test_admin_list_uploads(
    client: AsyncClient, db_session, admin_headers
):
    await _create_upload(db_session, city="Tokyo")
    r = await client.get("/admin/community-uploads", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Jane"
    assert r.json()[0]["city"] == "Tokyo"


async def test_admin_list_uploads_filter_by_status(
    client: AsyncClient, db_session, admin_headers
):
    await _create_upload(db_session, upload_status=UploadStatus.pending)
    await _create_upload(db_session, upload_status=UploadStatus.reviewed)
    r = await client.get(
        "/admin/community-uploads?upload_status=pending", headers=admin_headers
    )
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_admin_update_upload_status(
    client: AsyncClient, db_session, admin_headers
):
    upload = await _create_upload(db_session)
    r = await client.patch(
        f"/admin/community-uploads/{upload.id}",
        json={"status": "reviewed"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "reviewed"


async def test_admin_update_upload_not_found(client: AsyncClient, admin_headers):
    r = await client.patch(
        "/admin/community-uploads/fake-id",
        json={"status": "reviewed"},
        headers=admin_headers,
    )
    assert r.status_code == 404


async def test_admin_update_upload_forbidden_for_host(
    client: AsyncClient, db_session, host_headers
):
    upload = await _create_upload(db_session)
    r = await client.patch(
        f"/admin/community-uploads/{upload.id}",
        json={"status": "reviewed"},
        headers=host_headers,
    )
    assert r.status_code == 403
