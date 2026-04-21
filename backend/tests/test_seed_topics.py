"""Test topic seeding."""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.seed import _TOPICS, seed_topics
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


def test_seed_data_has_correct_count():
    assert len(_TOPICS) == 6


def test_all_topics_have_required_fields():
    required = {"title", "content"}
    for topic in _TOPICS:
        missing = required - set(topic.keys())
        assert not missing, f"Topic {topic.get('title', '?')} missing fields: {missing}"


def test_all_topics_have_non_empty_content():
    for topic in _TOPICS:
        assert topic["content"].strip(), f"Topic '{topic['title']}' has empty content"
