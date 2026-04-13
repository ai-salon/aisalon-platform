"""Shared test fixtures."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.admin as admin_module
from app.main import app
from app.models.base import Base
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.core.security import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    # Patch AsyncSessionLocal used directly by run_job background task
    _original = admin_module.AsyncSessionLocal
    admin_module.AsyncSessionLocal = Session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    admin_module.AsyncSessionLocal = _original


# ── Auth helpers ────────────────────────────────────────────────────────────

async def _make_user(
    session, email: str, role: UserRole,
    chapter_id: str | None = None, username: str | None = None,
) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password("password"),
        role=role,
        chapter_id=chapter_id,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def _get_token(client: AsyncClient, email: str) -> str:
    r = await client.post("/auth/login", json={"identifier": email, "password": "password"})
    return r.json()["access_token"]


@pytest_asyncio.fixture
async def superadmin(db_session):
    return await _make_user(db_session, "admin@aisalon.xyz", UserRole.superadmin, username="admin")


@pytest_asyncio.fixture
async def admin_token(client, superadmin) -> str:
    return await _get_token(client, superadmin.email)


@pytest_asyncio.fixture
async def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest_asyncio.fixture
async def sf_chapter(db_session) -> Chapter:
    ch = Chapter(
        code="sf", name="San Francisco", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    db_session.add(ch)
    await db_session.commit()
    await db_session.refresh(ch)
    return ch


@pytest_asyncio.fixture
async def chapter_lead(db_session, sf_chapter) -> User:
    return await _make_user(db_session, "lead@aisalon.xyz", UserRole.chapter_lead, sf_chapter.id, username="sf")


@pytest_asyncio.fixture
async def lead_token(client, chapter_lead) -> str:
    return await _get_token(client, chapter_lead.email)


@pytest_asyncio.fixture
async def lead_headers(lead_token) -> dict:
    return {"Authorization": f"Bearer {lead_token}"}


@pytest_asyncio.fixture
async def host_user(db_session, sf_chapter) -> User:
    return await _make_user(
        db_session, "host@aisalon.xyz", UserRole.host,
        sf_chapter.id, username="hostuser",
    )


@pytest_asyncio.fixture
async def host_token(client, host_user) -> str:
    return await _get_token(client, host_user.email)


@pytest_asyncio.fixture
async def host_headers(host_token) -> dict:
    return {"Authorization": f"Bearer {host_token}"}
