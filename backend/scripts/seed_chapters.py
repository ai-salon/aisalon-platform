"""Seed all 7 Ai Salon chapters + team members.

Usage:
    cd backend && poetry run python scripts/seed_chapters.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.models.chapter  # noqa: F401
import app.models.team_member  # noqa: F401
import app.models.user  # noqa: F401
import app.models.api_key  # noqa: F401
import app.models.job  # noqa: F401
import app.models.article  # noqa: F401
import app.models.hosting_interest  # noqa: F401

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.chapter import Chapter
from app.models.team_member import TeamMember

PEOPLE = "/images/people"

IAN = dict(
    name="Ian Eisenberg",
    role="Co-Founder",
    description=(
        "Ian focuses on system-level interventions to make AI more effective and "
        "beneficial. Besides the salon, he leads Credo AI's AI Governance Research "
        "team. In a past life he was a cognitive neuroscientist and has been a "
        "researcher at Stanford, the NIH, Columbia, and Brown."
    ),
    profile_image_url=f"{PEOPLE}/ian_eisenberg.jpeg",
    linkedin="https://www.linkedin.com/in/ian-eisenberg-aa17b594/",
    is_cofounder=True,
    display_order=90,
)

CECILIA = dict(
    name="Cecilia Callas",
    role="Co-Founder",
    description=(
        "Cecilia Callas is an AI Ethicist, Responsible AI expert and writer based "
        "in San Francisco, CA. Her core focus is empowering the public with content, "
        "events and resources that increase knowledge about the necessity of safe, "
        "ethical and responsible AI."
    ),
    profile_image_url=f"{PEOPLE}/cecilia_callas.jpeg",
    linkedin="https://www.linkedin.com/in/ceciliacallas/",
    is_cofounder=True,
    display_order=91,
)

CHAPTERS = [
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
        event_link="https://lu.ma/Ai-salon?tag=sf",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=sf",
        events_description=(
            "Join us in San Francisco for intimate salons and larger symposia exploring "
            "AI's impact on technology, society, and the future."
        ),
        team=[
            IAN,
            CECILIA,
            dict(
                name="Medha Bankhwal",
                role="SF Chapter Host: Trustworthy AI Futures",
                description="",
                profile_image_url=f"{PEOPLE}/medha_bankhwal.jpeg",
                linkedin="https://www.linkedin.com/in/medhabankhwal/",
                is_cofounder=False,
                display_order=0,
            ),
            dict(
                name="Banu Kellner",
                role="SF Chapter Host",
                description="",
                profile_image_url=f"{PEOPLE}/banu_kellner.jpeg",
                linkedin="https://www.linkedin.com/in/banuhantal/",
                is_cofounder=False,
                display_order=1,
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
        event_link="https://lu.ma/Ai-salon?tag=berlin",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=berlin",
        events_description=(
            "Berlin's vibrant tech and policy scene meets to explore AI's transformative "
            "potential through intimate salons and cross-cultural dialogue."
        ),
        team=[
            dict(
                name="Apurba Kundu",
                role="Berlin Chapter Co-Lead",
                description=(
                    "Apurba is a tech lawyer by training and currently a public policy "
                    "master's student navigating trustworthy AI governance."
                ),
                profile_image_url=f"{PEOPLE}/apurba_kundu.jpeg",
                linkedin="https://www.linkedin.com/in/apurba-kundu-3a445a26/",
                is_cofounder=False,
                display_order=0,
            ),
            dict(
                name="Justin Shenk",
                role="Berlin Chapter Co-Lead",
                description="Justin is a software engineer hosting chats, still working on aligning his agents.",
                profile_image_url=f"{PEOPLE}/justin_shenk.jpeg",
                linkedin="https://www.linkedin.com/in/justinshenk/",
                is_cofounder=False,
                display_order=1,
            ),
            IAN,
            CECILIA,
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
        event_link="https://lu.ma/Ai-salon?tag=london",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=london",
        events_description=(
            "London's world-class AI ecosystem gathers for thoughtful conversations "
            "spanning finance, policy, research, and the arts."
        ),
        team=[IAN, CECILIA],
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
        event_link="https://lu.ma/Ai-salon?tag=bangalore",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=bangalore",
        events_description=(
            "India's tech capital hosts rich conversations on AI's potential to transform "
            "one of the world's fastest-growing economies."
        ),
        team=[
            dict(
                name="Sharat Satyanarayana",
                role="Bangalore Chapter Lead",
                description="",
                profile_image_url=f"{PEOPLE}/sharat_satyanarayana.jpeg",
                linkedin="https://www.linkedin.com/in/sharats/",
                is_cofounder=False,
                display_order=0,
            ),
            dict(
                name="Anirudh Iyer",
                role="Bangalore Chapter Host",
                description="",
                profile_image_url=f"{PEOPLE}/anirudh_iyer.jpeg",
                linkedin="https://www.linkedin.com/in/anirudh-i/",
                is_cofounder=False,
                display_order=1,
            ),
            IAN,
            CECILIA,
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
        event_link="https://lu.ma/Ai-salon?tag=lagos",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=lagos",
        events_description=(
            "Lagos convenes Africa's AI community to explore how the continent can shape "
            "— and benefit from — the global AI transformation."
        ),
        team=[
            dict(
                name="Francis Sani",
                role="Lagos Chapter Lead",
                description="",
                profile_image_url=f"{PEOPLE}/francis_sani.jpeg",
                linkedin="https://www.linkedin.com/in/francis-sani-o-83534ba9/",
                is_cofounder=False,
                display_order=0,
            ),
            IAN,
            CECILIA,
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
        event_link="https://lu.ma/Ai-salon?tag=vancouver",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=vancouver",
        events_description=(
            "Vancouver's diverse tech community gathers to explore responsible AI "
            "development with Canadian values at the forefront."
        ),
        team=[
            dict(
                name="Mikhail Klassen",
                role="Vancouver Chapter Lead",
                description=(
                    "Mikhail is an AI engineer, physicist, and entrepreneur passionate "
                    "about AI's impact on science and society. He specializes in AI for "
                    "remote sensing to monitor our changing planet and previously founded "
                    "an aerospace startup. As a salon host, he fosters conversations on "
                    "how AI can advance humanity, the sciences, and life on Earth."
                ),
                profile_image_url=f"{PEOPLE}/mikhail_klassen.jpeg",
                linkedin="https://www.linkedin.com/in/mikhailklassen/",
                is_cofounder=False,
                display_order=0,
            ),
            IAN,
            CECILIA,
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
        event_link="https://lu.ma/Ai-salon?tag=nyc",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=nyc",
        events_description=(
            "New York's unparalleled mix of finance, media, tech, and culture creates "
            "a uniquely rich context for conversations about AI's future."
        ),
        team=[
            dict(
                name="Rupi Sureshkumar",
                role="New York City Chapter Lead",
                description="",
                profile_image_url=f"{PEOPLE}/rupi_sureshkumar.jpeg",
                linkedin="https://www.linkedin.com/in/rupi-sureshkumar/",
                is_cofounder=False,
                display_order=0,
            ),
            IAN,
            CECILIA,
        ],
    ),
]


async def seed_chapters() -> None:
    async with AsyncSessionLocal() as db:
        for ch_data in CHAPTERS:
            team = ch_data.pop("team")

            result = await db.execute(select(Chapter).where(Chapter.code == ch_data["code"]))
            chapter = result.scalar_one_or_none()
            if not chapter:
                chapter = Chapter(**ch_data)
                db.add(chapter)
                await db.flush()  # get chapter.id
                print(f"  Created chapter: {chapter.name}")
            else:
                print(f"  Chapter exists: {chapter.name}")

            for member_data in team:
                exists = await db.execute(
                    select(TeamMember).where(
                        TeamMember.chapter_id == chapter.id,
                        TeamMember.name == member_data["name"],
                    )
                )
                if not exists.scalar_one_or_none():
                    db.add(TeamMember(chapter_id=chapter.id, **member_data))

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(seed_chapters())
