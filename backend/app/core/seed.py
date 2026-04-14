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
from app.models.topic import Topic

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
            "Mine and organize insights from 2+ years of AI Salon discussions across cities "
            "and disciplines. Working with transcripts and summaries from our events, you'll "
            "identify recurring themes, track how public AI discourse is evolving, and shape "
            "that material into structured reports — published on our Substack and shared "
            "with our community — culminating in an Annual AI Salon Index Report.\n\n"
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
            "- Lead production of the Annual AI Salon Index Report\n"
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


_TOPICS = [
    dict(
        title="AI and the Future of Work",
        description=(
            "How will AI transform employment, skills, and the meaning of work itself? "
            "Explore automation, augmentation, and the evolving relationship between "
            "humans and machines in the workplace."
        ),
        opening_question="In what ways is AI already changing how you work, and what shifts do you anticipate in the next five years?",
        prompts=[
            "Which jobs or industries do you think will be most transformed by AI?",
            "How should education systems adapt to prepare people for an AI-augmented workforce?",
            "What policies could help ensure the benefits of AI in the workplace are shared broadly?",
        ],
        display_order=0,
    ),
    dict(
        title="AI Ethics and Governance",
        description=(
            "Who decides how AI systems should behave, and what frameworks should guide "
            "those decisions? Discuss accountability, transparency, bias, and the role of "
            "regulation in shaping responsible AI."
        ),
        opening_question="What ethical principle do you think is most often overlooked in AI development today?",
        prompts=[
            "Should AI systems be required to explain their decisions? In what contexts?",
            "How do we balance innovation speed with the need for safety and fairness?",
            "What role should governments play versus industry self-regulation?",
        ],
        display_order=1,
    ),
    dict(
        title="AI in Creative Arts",
        description=(
            "AI is generating art, music, and writing. Explore what this means for "
            "creativity, authorship, and the value we place on human expression in "
            "an age of machine-generated content."
        ),
        opening_question="When an AI creates a painting or writes a poem, is it art? Why or why not?",
        prompts=[
            "How do you think AI tools will change the creative process for artists and writers?",
            "Should AI-generated works be eligible for copyright protection?",
            "What is lost — or gained — when machines participate in creative expression?",
        ],
        display_order=2,
    ),
    dict(
        title="AI and Personal Privacy",
        description=(
            "AI systems collect and analyze vast amounts of personal data. Discuss the "
            "tension between personalization and privacy, surveillance, and what digital "
            "autonomy means in the AI era."
        ),
        opening_question="How comfortable are you with AI systems knowing your habits, preferences, and behaviors?",
        prompts=[
            "Where do you draw the line between helpful personalization and invasive surveillance?",
            "How should companies handle the data used to train AI models?",
            "What rights should individuals have over AI-generated insights about them?",
        ],
        display_order=3,
    ),
    dict(
        title="AI and Education",
        description=(
            "From personalized tutoring to automated grading, AI is reshaping how we "
            "learn and teach. Explore what this means for students, educators, and the "
            "future of knowledge."
        ),
        opening_question="How should schools and universities integrate AI tools into learning?",
        prompts=[
            "Will AI tutors make education more equitable or widen existing gaps?",
            "How do we teach critical thinking when AI can generate convincing answers to any question?",
            "What skills become more important — not less — in an AI-powered world?",
        ],
        display_order=4,
    ),
    dict(
        title="AI and Health",
        description=(
            "AI is diagnosing diseases, discovering drugs, and personalizing treatment. "
            "Explore the promise and the perils of AI in healthcare — from bias in medical "
            "AI to the future of the doctor-patient relationship."
        ),
        opening_question="Would you trust an AI to diagnose a medical condition? What would make you more or less comfortable?",
        prompts=[
            "How do we ensure AI health tools work equally well for all populations?",
            "What role should AI play in mental health support?",
            "How might AI change the relationship between patients and doctors?",
        ],
        display_order=5,
    ),
]


async def seed_topics() -> None:
    """Create initial conversation topics (idempotent)."""
    async with AsyncSessionLocal() as db:
        for topic_data in _TOPICS:
            result = await db.execute(
                select(Topic).where(Topic.title == topic_data["title"])
            )
            if not result.scalar_one_or_none():
                db.add(Topic(**topic_data))
                logger.info("Seeded topic: %s", topic_data["title"])
        await db.commit()
