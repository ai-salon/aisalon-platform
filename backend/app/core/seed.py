"""Startup seed: superadmin + chapters + chapter leads + founders + topics + volunteer roles."""
from datetime import datetime, timezone
from pathlib import Path
import re
import secrets
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.models.volunteer import VolunteerRole
from app.models.topic import Topic

logger = get_logger(__name__)

_P = "/images/people"

_TOPICS_DIR = Path(__file__).resolve().parents[2] / "docs" / "topics"


def _now():
    return datetime.now(timezone.utc)


_CHAPTERS = [
    dict(
        code="sf",
        name="San Francisco",
        title="The San Francisco Ai Salon",
        tagline="Where AI innovation meets thoughtful conversation",
        description=(
            "The San Francisco Ai Salon is where it all began. As our founding chapter, "
            "we bring together the vibrant Bay Area AI community to discuss the most "
            "pressing topics in artificial intelligence today."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=SF",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=SF",
        events_description=(
            "Join us in San Francisco for intimate salons and larger symposia exploring "
            "AI's impact on technology, society, and the future."
        ),
        status="active",
        lead_profile=None,
    ),
    dict(
        code="berlin",
        name="Berlin",
        title="The Berlin Ai Salon",
        tagline="Bridging European perspectives on AI",
        description=(
            "The Berlin Ai Salon brings together Europe's diverse perspectives on "
            "artificial intelligence, fostering cross-cultural dialogue on AI's future "
            "development and impact."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Berlin",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Berlin",
        events_description=(
            "Berlin's vibrant tech and policy scene meets to explore AI's transformative "
            "potential through intimate salons and cross-cultural dialogue."
        ),
        status="active",
        lead_profile=dict(
            name="Apurba Kundu",
            title="Berlin Chapter Lead",
            description=(
                "Apurba is a tech lawyer by training and currently a public policy "
                "master's student navigating trustworthy AI governance."
            ),
            profile_image_url=f"{_P}/apurba_kundu.jpeg",
            linkedin="https://www.linkedin.com/in/apurba-kundu-3a445a26/",
        ),
    ),
    dict(
        code="london", name="London", title="The London Ai Salon",
        tagline="Where British innovation meets global AI discourse",
        description=(
            "The London Ai Salon connects the UK's thriving AI community, bringing "
            "together diverse perspectives from the City's financial district, tech "
            "startups, and world-class universities."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=London",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=London",
        events_description=(
            "London's world-class AI ecosystem gathers for thoughtful conversations "
            "spanning finance, policy, research, and the arts."
        ),
        status="active",
        lead_profile=None,
    ),
    dict(
        code="bangalore", name="Bangalore", title="The Bangalore Ai Salon",
        tagline="Where Indian innovation meets global AI transformation",
        description=(
            "The Bangalore Ai Salon brings together India's vibrant tech ecosystem, "
            "connecting engineers, researchers, entrepreneurs, and thought leaders to "
            "shape AI's future in the world's largest democracy."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=Bangalore",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Bangalore",
        events_description=(
            "India's tech capital hosts rich conversations on AI's potential to transform "
            "one of the world's fastest-growing economies."
        ),
        status="active",
        lead_profile=dict(
            username="sharat",
            name="Sharat Satyanarayana",
            title="Bangalore Chapter Lead",
            description="",
            profile_image_url=f"{_P}/sharat_satyanarayana.jpeg",
            linkedin="https://www.linkedin.com/in/sharats/",
        ),
    ),
    dict(
        code="lagos", name="Lagos", title="The Lagos Ai Salon",
        tagline="Where African innovation shapes AI's global future",
        description=(
            "The Lagos Ai Salon connects Nigeria's growing tech ecosystem with global "
            "AI discourse, exploring how artificial intelligence can address African "
            "challenges and amplify African innovation."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=Lagos",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Lagos",
        events_description=(
            "Lagos convenes Africa's AI community to explore how the continent can shape "
            "— and benefit from — the global AI transformation."
        ),
        status="active",
        lead_profile=dict(
            username="francis",
            name="Francis Sani",
            title="Lagos Chapter Lead",
            description="",
            profile_image_url=f"{_P}/francis_sani.jpeg",
            linkedin="https://www.linkedin.com/in/francis-sani-o-83534ba9/",
        ),
    ),
    dict(
        code="vancouver", name="Vancouver", title="The Vancouver Ai Salon",
        tagline="Where Canadian values meet AI innovation",
        description=(
            "The Vancouver Ai Salon connects Canada's West Coast tech community, "
            "bringing together diverse perspectives on responsible AI development from "
            "one of the world's most livable and multicultural cities."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=Vancouver",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Vancouver",
        events_description=(
            "Vancouver's diverse tech community gathers to explore responsible AI "
            "development with Canadian values at the forefront."
        ),
        status="active",
        lead_profile=dict(
            username="mikhail",
            name="Mikhail Klassen",
            title="Vancouver Chapter Lead",
            description=(
                "Mikhail is an AI engineer, physicist, and entrepreneur passionate "
                "about AI's impact on science and society."
            ),
            profile_image_url=f"{_P}/mikhail_klassen.jpeg",
            linkedin="https://www.linkedin.com/in/mikhailklassen/",
        ),
    ),
    dict(
        code="zurich", name="Zurich", title="The Zurich Ai Salon",
        tagline="Where Swiss precision meets the future of AI",
        description=(
            "The Zurich Ai Salon brings together Switzerland's world-class research "
            "institutions, financial sector, and tech community to explore the meaning "
            "and impact of artificial intelligence."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=Zurich",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Zurich",
        events_description=(
            "Zurich's unique confluence of leading universities, global finance, and "
            "deep-tech innovation creates a rich setting for exploring AI's future."
        ),
        status="active",
        lead_profile=dict(
            username="pascale",
            name="Pascale Speck",
            title="Zurich Chapter Lead",
            description="",
            profile_image_url=f"{_P}/pascale_speck.jpeg",
            linkedin="",
        ),
    ),
    dict(
        code="nyc", name="New York City", title="The New York City Ai Salon",
        tagline="Where AI meets the world's most dynamic city",
        description=(
            "The New York City Ai Salon brings together the city's diverse AI community, "
            "from Wall Street to Silicon Alley, exploring how artificial intelligence "
            "intersects with finance, media, healthcare, and social impact."
        ),
        about="", event_link="https://lu.ma/Ai-salon?tag=NY",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=NY",
        events_description=(
            "New York's unparalleled mix of finance, media, tech, and culture creates "
            "a uniquely rich context for conversations about AI's future."
        ),
        status="active",
        lead_profile=dict(
            username="rupi",
            name="Rupi Sureshkumar",
            title="New York City Chapter Lead",
            description="",
            profile_image_url=f"{_P}/rupi_sureshkumar.jpeg",
            linkedin="https://www.linkedin.com/in/rupi-sureshkumar/",
        ),
    ),
]


_FOUNDERS = [
    dict(
        match_username="admin",
        name="Ian Eisenberg",
        title="Founder, Executive Director",
        description=(
            "Ian focuses on system-level interventions to make AI more effective and "
            "beneficial. Besides the salon, he leads Credo AI's AI Governance Research "
            "team."
        ),
        profile_image_url=f"{_P}/ian_eisenberg.jpeg",
        linkedin="https://www.linkedin.com/in/ian-eisenberg-aa17b594/",
        display_order=90,
    ),
    dict(
        match_username=None,
        username="cecilia",
        email="cecilia@aisalon.placeholder",
        chapter_code="sf",
        name="Cecilia Callas",
        title="Co-Founder, Advisor",
        description=(
            "Cecilia Callas is an AI Ethicist, Responsible AI expert and writer based "
            "in San Francisco, CA."
        ),
        profile_image_url=f"{_P}/cecilia_callas.jpeg",
        linkedin="https://www.linkedin.com/in/ceciliacallas/",
        display_order=91,
    ),
]


async def seed_superadmin() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none():
            return
        db.add(User(
            username="admin",
            email="admin@aisalon.xyz",
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            role=UserRole.superadmin,
            is_active=True,
        ))
        await db.commit()
        logger.info("Seeded superadmin: admin")


async def seed_chapters() -> None:
    async with AsyncSessionLocal() as db:
        for ch in _CHAPTERS:
            data = {k: v for k, v in ch.items() if k != "lead_profile"}
            result = await db.execute(select(Chapter).where(Chapter.code == data["code"]))
            existing = result.scalar_one_or_none()
            if not existing:
                db.add(Chapter(**data))
                logger.info("Seeded chapter: %s", data["name"])
        await db.commit()


async def seed_chapter_leads() -> None:
    """Create one base chapter_lead user per chapter (a 'ghost' admin login).

    These accounts (sf@aisalon.xyz, berlin@aisalon.xyz, ...) exist for every
    chapter regardless of who actually leads it. They are hidden from the
    public Team page (`hide_from_team=True`) and carry no profile data.
    Real chapter-lead person accounts are seeded separately by
    `seed_chapter_lead_profiles()`.
    """
    base_pw = settings.BASE_PASSWORD
    async with AsyncSessionLocal() as db:
        for ch in _CHAPTERS:
            code = ch["code"]
            ch_row = await db.execute(select(Chapter).where(Chapter.code == code))
            chapter = ch_row.scalar_one_or_none()
            if not chapter:
                continue

            user_row = await db.execute(select(User).where(User.username == code))
            user = user_row.scalar_one_or_none()

            if not user:
                user = User(
                    username=code,
                    email=f"{code}@aisalon.xyz",
                    hashed_password=hash_password(f"{base_pw}{code}"),
                    role=UserRole.chapter_lead,
                    chapter_id=chapter.id,
                    is_active=True,
                    hide_from_team=True,
                )
                db.add(user)
                await db.flush()
                logger.info("Seeded base chapter user: %s", code)

        await db.commit()


async def seed_chapter_lead_profiles() -> None:
    """Create a separate user account for each named chapter-lead person.

    For chapters whose `_CHAPTERS` entry has a `lead_profile` dict with a
    `username` key (e.g. Apurba for Berlin, Mikhail for Vancouver), seed an
    account at `<username>@aisalon.xyz` with password `{BASE_PASSWORD}{username}`,
    role=chapter_lead, scoped to that chapter, with the profile fields filled
    in. Idempotent: skips entries whose target user already has
    `profile_completed_at` set.
    """
    base_pw = settings.BASE_PASSWORD
    async with AsyncSessionLocal() as db:
        for ch in _CHAPTERS:
            profile = ch.get("lead_profile")
            if not profile or not profile.get("username"):
                continue

            ch_row = await db.execute(select(Chapter).where(Chapter.code == ch["code"]))
            chapter = ch_row.scalar_one_or_none()
            if not chapter:
                continue

            username = profile["username"]
            user_row = await db.execute(select(User).where(User.username == username))
            user = user_row.scalar_one_or_none()

            if not user:
                user = User(
                    username=username,
                    email=f"{username}@aisalon.xyz",
                    hashed_password=hash_password(f"{base_pw}{username}"),
                    role=UserRole.chapter_lead,
                    chapter_id=chapter.id,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                logger.info("Seeded chapter lead person: %s", username)

            if user.profile_completed_at:
                continue

            user.name = profile["name"]
            user.title = profile["title"]
            user.description = profile.get("description") or None
            user.profile_image_url = profile["profile_image_url"]
            user.linkedin = profile.get("linkedin") or None
            user.hide_from_team = False
            user.profile_completed_at = _now()

        await db.commit()


async def seed_founders() -> None:
    async with AsyncSessionLocal() as db:
        for f in _FOUNDERS:
            target = None
            if f.get("match_username"):
                row = await db.execute(select(User).where(User.username == f["match_username"]))
                target = row.scalar_one_or_none()
            if target is None and f.get("username"):
                row = await db.execute(select(User).where(User.username == f["username"]))
                target = row.scalar_one_or_none()
            if target is None and f.get("username"):
                chapter_id = None
                if f.get("chapter_code"):
                    cr = await db.execute(select(Chapter).where(Chapter.code == f["chapter_code"]))
                    ch = cr.scalar_one_or_none()
                    chapter_id = ch.id if ch else None
                target = User(
                    username=f["username"],
                    email=f.get("email") or f"{f['username']}@aisalon.placeholder",
                    hashed_password=hash_password(secrets.token_urlsafe(16)),
                    role=UserRole.host,
                    chapter_id=chapter_id,
                    is_active=True,
                )
                db.add(target)
                await db.flush()
                logger.info("Seeded founder user: %s", f["username"])

            if target.profile_completed_at:
                continue

            target.name = f["name"]
            target.title = f["title"]
            target.description = f.get("description") or None
            target.profile_image_url = f["profile_image_url"]
            target.linkedin = f.get("linkedin") or None
            target.is_founder = True
            target.display_order = f.get("display_order", 0)
            target.profile_completed_at = _now()

        await db.commit()


_VOLUNTEER_ROLES = [
    dict(
        title="Marketing & Social Lead",
        slug="marketing-social-lead",
        description=(
            "## About This Role\n\n"
            "Shape the public-facing voice of The Ai Salon across our Substack newsletter, "
            "LinkedIn, and Instagram/X. You'll own our content strategy — turning salon "
            "conversations into thought-leadership pieces, social posts, and newsletter "
            "content that grows our audience and introduces new people to the community.\n\n"
            "## Who Would Be a Good Fit?\n\n"
            "You're probably someone who genuinely loves both writing and building audiences "
            "online. Maybe you've run a newsletter, managed a brand's social presence, or "
            "created content that earned real engagement — and you found it satisfying rather "
            "than exhausting. You follow AI discourse closely and have opinions about it.\n\n"
            "**What you'll be doing:**\n"
            "- Write and schedule regular posts across LinkedIn and Instagram/X\n"
            "- Produce newsletter pieces for our Substack that distill salon insights for a broader audience\n"
            "- Build and maintain a rolling content calendar\n"
            "- Repurpose salon transcripts and articles into social-friendly formats\n"
            "- Track engagement and run experiments to grow our audience"
        ),
        requirements=None,
        time_commitment="2-4 hours/week",
        display_order=0,
    ),
    dict(
        title="Online Community Manager",
        slug="online-community-manager",
        description=(
            "## About This Role\n\n"
            "Keep the Ai Salon community alive and connected between events. You'll manage "
            "our online channels — including our WhatsApp groups and Discord server — "
            "fostering member conversations, welcoming new members, and creating the moments "
            "of connection that turn one-time attendees into an ongoing community.\n\n"
            "## Who Would Be a Good Fit?\n\n"
            "This role suits someone who finds community-building genuinely energizing — the "
            "kind of person who naturally makes introductions, checks in on people, and knows "
            "when a group conversation needs a nudge. You probably have some experience "
            "managing an online community or group, even informally. You don't need to be a "
            "deep AI expert — genuine curiosity and a desire to help people connect is what "
            "matters most.\n\n"
            "**What you'll be doing:**\n"
            "- Moderate and animate our WhatsApp groups and Discord server\n"
            "- Welcome new members and help them find their place in the community\n"
            "- Spot and surface interesting conversations worth amplifying\n"
            "- Keep regional and global members connected between events\n"
            "- Run occasional community pulse checks or informal surveys"
        ),
        requirements=None,
        time_commitment="2-4 hours/week",
        display_order=1,
    ),
    dict(
        title="Insights Lead",
        slug="insights-lead",
        description=(
            "## About This Role\n\n"
            "Mine and organize insights from 2+ years of Ai Salon discussions across cities "
            "and disciplines. Working with transcripts and summaries from our events, you'll "
            "identify recurring themes, track how public AI discourse is evolving, and shape "
            "that material into structured reports — published on our Substack and shared "
            "with our community — culminating in an Annual Ai Salon Index Report.\n\n"
            "## Who Would Be a Good Fit?\n\n"
            "You're drawn to this if you love finding patterns in a pile of qualitative "
            "material and turning them into something coherent and useful. Maybe you've done "
            "research synthesis, policy analysis, journalism, or academic writing — anything "
            "where the craft is making sense of complex, messy information. You're interested "
            "in AI not just as a technical topic but as a social and cultural phenomenon.\n\n"
            "**What you'll be doing:**\n"
            "- Review transcripts and summaries from past and upcoming salon events\n"
            "- Identify cross-cutting themes across cities, disciplines, and time\n"
            "- Write thematic reports and briefings published on our Substack\n"
            "- Lead production of the Annual Ai Salon Index Report\n"
            "- Work with AI-assisted tools to surface patterns across our archive"
        ),
        requirements=None,
        time_commitment="2-4 hours/week",
        display_order=2,
    ),
]


async def seed_volunteer_roles() -> None:
    """Create initial volunteer roles (idempotent)."""
    async with AsyncSessionLocal() as db:
        for role_data in _VOLUNTEER_ROLES:
            result = await db.execute(
                select(VolunteerRole).where(VolunteerRole.slug == role_data["slug"])
            )
            if not result.scalar_one_or_none():
                db.add(VolunteerRole(**role_data))
                logger.info("Seeded volunteer role: %s", role_data["title"])
        await db.commit()


def _parse_topic_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").strip()
    lines = text.splitlines()
    title = ""
    body_start = 0
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+(.+)", line)
        if m:
            title = m.group(1).strip()
            body_start = i + 1
            break
    while body_start < len(lines) and not lines[body_start].strip():
        body_start += 1
    return {"title": title, "content": "\n".join(lines[body_start:]).strip()}


async def seed_topics() -> None:
    """Upsert conversation topics from docs/topics/*.md (idempotent)."""
    if not _TOPICS_DIR.exists():
        logger.warning("topics_dir_missing", path=str(_TOPICS_DIR))
        return

    md_files = sorted(_TOPICS_DIR.glob("*.md"))
    async with AsyncSessionLocal() as db:
        for path in md_files:
            parsed = _parse_topic_file(path)
            if not parsed["title"]:
                logger.warning("topic_no_title", file=path.name)
                continue

            result = await db.execute(select(Topic).where(Topic.title == parsed["title"]))
            topic = result.scalar_one_or_none()
            if topic:
                topic.content = parsed["content"]
                topic.is_active = True
            else:
                db.add(Topic(
                    title=parsed["title"],
                    content=parsed["content"],
                    is_active=True,
                ))
                logger.info("Seeded topic: %s", parsed["title"])
        await db.commit()
