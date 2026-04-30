"""Test topic seeding."""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.seed import _TOPICS_DIR, _parse_topic_file, seed_topics
from app.models.topic import Topic


async def test_seed_topics_creates_topics(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_topics()
    async with TestSession() as session:
        result = await session.execute(select(Topic))
        topics = result.scalars().all()
    assert len(topics) >= 4


async def test_seed_topics_is_idempotent(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_topics()
        await seed_topics()
    async with TestSession() as session:
        result = await session.execute(select(Topic))
        topics = result.scalars().all()
    assert len(topics) >= 4
    titles = [t.title for t in topics]
    assert len(titles) == len(set(titles))


async def test_seed_topics_updates_content_from_markdown(db_engine):
    """Re-running seed should pick up edits to the markdown files."""
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_topics()
        async with TestSession() as session:
            row = await session.execute(select(Topic).limit(1))
            topic = row.scalar_one()
            topic.content = "stale"
            await session.commit()
        await seed_topics()
        async with TestSession() as session:
            refreshed = (await session.execute(select(Topic).where(Topic.id == topic.id))).scalar_one()
            assert refreshed.content != "stale"


def test_topics_dir_exists():
    assert _TOPICS_DIR.exists(), f"Topics dir missing: {_TOPICS_DIR}"
    assert list(_TOPICS_DIR.glob("*.md")), "No topic .md files found"


def test_all_topic_files_have_title_and_content():
    for path in _TOPICS_DIR.glob("*.md"):
        parsed = _parse_topic_file(path)
        assert parsed["title"], f"{path.name} has no '# Title' line"
        assert parsed["content"].strip(), f"{path.name} has empty content"
