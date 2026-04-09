"""Startup seed: superadmin + all chapters + team members + volunteer roles."""
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.models.team_member import TeamMember
from app.models.volunteer import VolunteerRole

logger = get_logger(__name__)

_P = "/images/people"

_IAN = dict(
    name="Ian Eisenberg",
    role="Co-Founder",
    description=(
        "Ian focuses on system-level interventions to make AI more effective and "
        "beneficial. Besides the salon, he leads Credo AI's AI Governance Research "
        "team. In a past life he was a cognitive neuroscientist and has been a "
        "researcher at Stanford, the NIH, Columbia, and Brown."
    ),
    profile_image_url=f"{_P}/ian_eisenberg.jpeg",
    linkedin="https://www.linkedin.com/in/ian-eisenberg-aa17b594/",
    is_cofounder=True,
    display_order=90,
)

_CECILIA = dict(
    name="Cecilia Callas",
    role="Co-Founder",
    description=(
        "Cecilia Callas is an AI Ethicist, Responsible AI expert and writer based "
        "in San Francisco, CA. Her core focus is empowering the public with content, "
        "events and resources that increase knowledge about the necessity of safe, "
        "ethical and responsible AI."
    ),
    profile_image_url=f"{_P}/cecilia_callas.jpeg",
    linkedin="https://www.linkedin.com/in/ceciliacallas/",
    is_cofounder=True,
    display_order=91,
)

_CHAPTERS = [
    dict(
        code="sf",
        name="San Francisco",
        title="The San Francisco Ai Salon",
        tagline="Where AI innovation meets thoughtful conversation",
        description=(
            "The San Francisco AI Salon is where it all began. As our founding chapter, "
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
        team=[
            _IAN,
            _CECILIA,
            dict(
                name="Medha Bankhwal",
                role="Host",
                description="",
                profile_image_url=f"{_P}/medha_bankhwal.jpeg",
                linkedin="https://www.linkedin.com/in/medhabankhwal/",
                is_cofounder=False, display_order=0,
            ),
            dict(
                name="Banu Kellner",
                role="Host",
                description="",
                profile_image_url=f"{_P}/banu_kellner.jpeg",
                linkedin="https://www.linkedin.com/in/banuhantal/",
                is_cofounder=False, display_order=1,
            ),
        ],
    ),
    dict(
        code="berlin",
        name="Berlin",
        title="The Berlin Ai Salon",
        tagline="Bridging European perspectives on AI",
        description=(
            "The Berlin AI Salon brings together Europe's diverse perspectives on "
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
        team=[
            dict(
                name="Apurba Kundu",
                role="Chapter Lead",
                description=(
                    "Apurba is a tech lawyer by training and currently a public policy "
                    "master's student navigating trustworthy AI governance."
                ),
                profile_image_url=f"{_P}/apurba_kundu.jpeg",
                linkedin="https://www.linkedin.com/in/apurba-kundu-3a445a26/",
                is_cofounder=False, display_order=0,
            ),
            dict(
                name="Justin Shenk",
                role="Chapter Lead",
                description="Justin is a software engineer hosting chats, still working on aligning his agents.",
                profile_image_url=f"{_P}/justin_shenk.jpeg",
                linkedin="https://www.linkedin.com/in/justinshenk/",
                is_cofounder=False, display_order=1,
            ),
        ],
    ),
    dict(
        code="london",
        name="London",
        title="The London Ai Salon",
        tagline="Where British innovation meets global AI discourse",
        description=(
            "The London AI Salon connects the UK's thriving AI community, bringing "
            "together diverse perspectives from the City's financial district, tech "
            "startups, and world-class universities."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=London",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=London",
        events_description=(
            "London's world-class AI ecosystem gathers for thoughtful conversations "
            "spanning finance, policy, research, and the arts."
        ),
        team=[],
    ),
    dict(
        code="bangalore",
        name="Bangalore",
        title="The Bangalore Ai Salon",
        tagline="Where Indian innovation meets global AI transformation",
        description=(
            "The Bangalore AI Salon brings together India's vibrant tech ecosystem, "
            "connecting engineers, researchers, entrepreneurs, and thought leaders to "
            "shape AI's future in the world's largest democracy."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Bangalore",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Bangalore",
        events_description=(
            "India's tech capital hosts rich conversations on AI's potential to transform "
            "one of the world's fastest-growing economies."
        ),
        team=[
            dict(
                name="Sharat Satyanarayana",
                role="Chapter Lead",
                description="",
                profile_image_url=f"{_P}/sharat_satyanarayana.jpeg",
                linkedin="https://www.linkedin.com/in/sharats/",
                is_cofounder=False, display_order=0,
            ),
            dict(
                name="Anirudh Iyer",
                role="Host",
                description="",
                profile_image_url=f"{_P}/anirudh_iyer.jpeg",
                linkedin="https://www.linkedin.com/in/anirudh-i/",
                is_cofounder=False, display_order=1,
            ),
        ],
    ),
    dict(
        code="lagos",
        name="Lagos",
        title="The Lagos Ai Salon",
        tagline="Where African innovation shapes AI's global future",
        description=(
            "The Lagos AI Salon connects Nigeria's growing tech ecosystem with global "
            "AI discourse, exploring how artificial intelligence can address African "
            "challenges and amplify African innovation."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Lagos",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Lagos",
        events_description=(
            "Lagos convenes Africa's AI community to explore how the continent can shape "
            "— and benefit from — the global AI transformation."
        ),
        team=[
            dict(
                name="Francis Sani",
                role="Chapter Lead",
                description="",
                profile_image_url=f"{_P}/francis_sani.jpeg",
                linkedin="https://www.linkedin.com/in/francis-sani-o-83534ba9/",
                is_cofounder=False, display_order=0,
            ),
        ],
    ),
    dict(
        code="vancouver",
        name="Vancouver",
        title="The Vancouver Ai Salon",
        tagline="Where Canadian values meet AI innovation",
        description=(
            "The Vancouver AI Salon connects Canada's West Coast tech community, "
            "bringing together diverse perspectives on responsible AI development from "
            "one of the world's most livable and multicultural cities."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Vancouver",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Vancouver",
        events_description=(
            "Vancouver's diverse tech community gathers to explore responsible AI "
            "development with Canadian values at the forefront."
        ),
        team=[
            dict(
                name="Mikhail Klassen",
                role="Chapter Lead",
                description=(
                    "Mikhail is an AI engineer, physicist, and entrepreneur passionate "
                    "about AI's impact on science and society. He specializes in AI for "
                    "remote sensing to monitor our changing planet and previously founded "
                    "an aerospace startup. As a salon host, he fosters conversations on "
                    "how AI can advance humanity, the sciences, and life on Earth."
                ),
                profile_image_url=f"{_P}/mikhail_klassen.jpeg",
                linkedin="https://www.linkedin.com/in/mikhailklassen/",
                is_cofounder=False, display_order=0,
            ),
        ],
    ),
    dict(
        code="zurich",
        name="Zurich",
        title="The Zurich Ai Salon",
        tagline="Where Swiss precision meets the future of AI",
        description=(
            "The Zurich AI Salon brings together Switzerland's world-class research "
            "institutions, financial sector, and tech community to explore the meaning "
            "and impact of artificial intelligence."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Zurich",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Zurich",
        events_description=(
            "Zurich's unique confluence of leading universities, global finance, and "
            "deep-tech innovation creates a rich setting for exploring AI's future."
        ),
        team=[
            dict(
                name="Pascale Speck",
                role="Chapter Lead",
                description="",
                profile_image_url=f"{_P}/pascale_speck.jpeg",
                linkedin="",
                is_cofounder=False,
                display_order=0,
            ),
        ],
    ),
    dict(
        code="nyc",
        name="New York City",
        title="The New York City Ai Salon",
        tagline="Where AI meets the world's most dynamic city",
        description=(
            "The New York City AI Salon brings together the city's diverse AI community, "
            "from Wall Street to Silicon Alley, exploring how artificial intelligence "
            "intersects with finance, media, healthcare, and social impact."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=NY",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=NY",
        events_description=(
            "New York's unparalleled mix of finance, media, tech, and culture creates "
            "a uniquely rich context for conversations about AI's future."
        ),
        team=[
            dict(
                name="Rupi Sureshkumar",
                role="Chapter Lead",
                description="",
                profile_image_url=f"{_P}/rupi_sureshkumar.jpeg",
                linkedin="https://www.linkedin.com/in/rupi-sureshkumar/",
                is_cofounder=False, display_order=0,
            ),
        ],
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
        for ch_data in _CHAPTERS:
            team = ch_data.pop("team")
            result = await db.execute(select(Chapter).where(Chapter.code == ch_data["code"]))
            chapter = result.scalar_one_or_none()
            if not chapter:
                chapter = Chapter(**ch_data)
                db.add(chapter)
                await db.flush()
                logger.info("Seeded chapter: %s", chapter.name)

            for member_data in team:
                exists = await db.execute(
                    select(TeamMember).where(
                        TeamMember.chapter_id == chapter.id,
                        TeamMember.name == member_data["name"],
                    )
                )
                if not exists.scalar_one_or_none():
                    db.add(TeamMember(chapter_id=chapter.id, **member_data))

            # Restore team so this function is safe to call multiple times
            ch_data["team"] = team

        await db.commit()


async def seed_chapter_leads() -> None:
    """Create one chapter_lead user per chapter (idempotent)."""
    base_pw = settings.BASE_PASSWORD
    async with AsyncSessionLocal() as db:
        for ch_data in _CHAPTERS:
            code = ch_data["code"]

            ch_result = await db.execute(select(Chapter).where(Chapter.code == code))
            chapter = ch_result.scalar_one_or_none()
            if not chapter:
                continue

            user_result = await db.execute(select(User).where(User.username == code))
            if user_result.scalar_one_or_none():
                continue

            db.add(User(
                username=code,
                email=f"{code}@aisalon.xyz",
                hashed_password=hash_password(f"{base_pw}{code}"),
                role=UserRole.chapter_lead,
                chapter_id=chapter.id,
                is_active=True,
            ))
            logger.info("Seeded chapter lead: %s", code)

        await db.commit()


_VOLUNTEER_ROLES = [
    dict(
        title="Chapter Lead",
        slug="chapter-lead",
        description=(
            "Chapter Leads are the heart of the Ai Salon's global presence. You'll build "
            "and nurture a local AI community, organizing monthly salons that bring together "
            "diverse voices to explore AI's impact on society.\n\n"
            "**Why this role matters:** Each chapter is a local hub where people from all "
            "backgrounds come together to understand AI — not just technologists, but "
            "policymakers, artists, educators, and curious citizens. As a Chapter Lead, "
            "you shape these conversations and help your city become part of a global "
            "movement for thoughtful AI discourse."
        ),
        requirements=(
            "- Passion for AI and its societal implications\n"
            "- Experience organizing events or building communities\n"
            "- Strong communication and facilitation skills\n"
            "- Ability to recruit and coordinate local hosts\n"
            "- Based in a city without an existing Ai Salon chapter"
        ),
        time_commitment="6-10 hours/month",
        display_order=0,
    ),
    dict(
        title="Salon Host",
        slug="salon-host",
        description=(
            "Salon Hosts facilitate individual salon discussions, creating a welcoming space "
            "where participants feel comfortable sharing ideas and challenging assumptions "
            "about AI.\n\n"
            "**Why this role matters:** The quality of a salon depends on its facilitation. "
            "Great hosts draw out quiet voices, keep discussions productive, and ensure every "
            "participant leaves having learned something new. You're the person who makes the "
            "magic happen in the room."
        ),
        requirements=(
            "- Comfort facilitating group discussions (8-30 people)\n"
            "- Interest in AI topics across technical and social dimensions\n"
            "- Good listening skills and ability to synthesize ideas\n"
            "- Located in a city with an existing Ai Salon chapter"
        ),
        time_commitment="4-6 hours/month",
        display_order=1,
    ),
    dict(
        title="Content Writer",
        slug="content-writer",
        description=(
            "Content Writers transform salon discussions into compelling articles that extend "
            "the conversation beyond the room. Using our AI-assisted pipeline, you'll craft "
            "narratives that capture key insights while making complex AI topics accessible.\n\n"
            "**Why this role matters:** Most salon conversations are ephemeral — brilliant "
            "insights shared in the room vanish when people go home. Our writers preserve and "
            "amplify these ideas, creating a growing library of community-generated thought "
            "leadership on AI."
        ),
        requirements=(
            "- Strong writing skills with ability to distill complex topics\n"
            "- Interest in AI policy, ethics, technology, or culture\n"
            "- Comfort working with AI-assisted writing tools\n"
            "- Ability to meet publishing deadlines"
        ),
        time_commitment="3-5 hours/month",
        display_order=2,
    ),
    dict(
        title="Social Media Manager",
        slug="social-media-manager",
        description=(
            "Social Media Managers amplify the Ai Salon's voice across platforms, sharing "
            "salon insights, promoting events, and building our online community.\n\n"
            "**Why this role matters:** The conversations happening in our salons deserve "
            "a wider audience. You'll help bridge the gap between in-person discussions and "
            "the broader public discourse on AI, ensuring our community's insights reach "
            "the people who need to hear them."
        ),
        requirements=(
            "- Experience managing social media accounts (Twitter/X, LinkedIn, Substack)\n"
            "- Understanding of AI topics and current discourse\n"
            "- Strong copywriting skills for short-form content\n"
            "- Familiarity with social media analytics"
        ),
        time_commitment="3-5 hours/week",
        display_order=3,
    ),
    dict(
        title="Community Manager",
        slug="community-manager",
        description=(
            "Community Managers nurture our online spaces, ensuring members feel welcomed, "
            "connected, and engaged between salon events.\n\n"
            "**Why this role matters:** A salon is more than an event — it's a community. "
            "Between monthly gatherings, our Discord and online channels keep the conversation "
            "alive. You'll foster the connections that turn attendees into a true community of "
            "practice around responsible AI."
        ),
        requirements=(
            "- Experience moderating online communities (Discord, Slack, forums)\n"
            "- Strong interpersonal skills and conflict resolution ability\n"
            "- Passion for building inclusive, welcoming spaces\n"
            "- Availability to check in on community channels regularly"
        ),
        time_commitment="4-6 hours/week",
        display_order=4,
    ),
    dict(
        title="Event Coordinator",
        slug="event-coordinator",
        description=(
            "Event Coordinators plan and execute special events — from cross-chapter symposia "
            "to partnerships with other organizations — that expand the Ai Salon's reach "
            "and impact.\n\n"
            "**Why this role matters:** Beyond regular monthly salons, special events create "
            "landmark moments for our community. Whether it's a multi-city AI symposium or "
            "a collaboration with a university, these events push the boundaries of what our "
            "community can accomplish together."
        ),
        requirements=(
            "- Event planning experience (virtual and/or in-person)\n"
            "- Strong organizational and project management skills\n"
            "- Ability to coordinate across time zones and teams\n"
            "- Creative thinking for event formats and programming"
        ),
        time_commitment="5-10 hours/month (varies by event cycle)",
        display_order=5,
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
