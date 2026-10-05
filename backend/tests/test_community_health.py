"""Tests for the chapter community health score."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.community_health import HealthInputs, compute_health

NOW = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
TODAY = NOW.date()


def _inputs(**kw) -> HealthInputs:
    base = dict(
        events_last_year=0,
        last_event_at=None,
        upcoming_events=0,
        events_available=True,
        articles_last_year=0,
        last_article_on=None,
        people=0,
        has_lead=False,
    )
    base.update(kw)
    return HealthInputs(**base)


def _points(result, key):
    return next(c for c in result.components if c.key == key).points


class TestScore:
    def test_empty_chapter_scores_zero(self):
        r = compute_health(_inputs(), NOW)
        assert r.score == 0
        assert r.label == "At risk"
        assert r.partial is False

    def test_fully_active_chapter_scores_100(self):
        r = compute_health(
            _inputs(
                events_last_year=12,
                last_event_at=NOW - timedelta(days=10),
                upcoming_events=1,
                articles_last_year=6,
                last_article_on=TODAY - timedelta(days=20),
                people=5,
                has_lead=True,
            ),
            NOW,
        )
        assert r.score == 100
        assert r.label == "Thriving"

    def test_components_sum_to_score_and_max_100(self):
        r = compute_health(
            _inputs(events_last_year=3, last_event_at=NOW - timedelta(days=100),
                    articles_last_year=1, last_article_on=TODAY - timedelta(days=200),
                    people=2, has_lead=True),
            NOW,
        )
        assert sum(c.max_points for c in r.components) == 100
        assert r.score == round(sum(c.points for c in r.components))

    @pytest.mark.parametrize("score,label", [(80, "Thriving"), (60, "Steady"), (30, "Needs attention"), (10, "At risk")])
    def test_labels(self, score, label):
        from app.services.community_health import label_for
        assert label_for(score) == label


class TestEvents:
    def test_cadence_scales_to_target(self):
        assert _points(compute_health(_inputs(events_last_year=3), NOW), "event_cadence") == 12.5
        assert _points(compute_health(_inputs(events_last_year=6), NOW), "event_cadence") == 25
        assert _points(compute_health(_inputs(events_last_year=40), NOW), "event_cadence") == 25

    def test_upcoming_event_gives_full_momentum(self):
        r = compute_health(_inputs(upcoming_events=1, last_event_at=NOW - timedelta(days=400)), NOW)
        assert _points(r, "event_momentum") == 20

    def test_momentum_decays_with_time_since_last_event(self):
        recent = compute_health(_inputs(last_event_at=NOW - timedelta(days=30)), NOW)
        mid = compute_health(_inputs(last_event_at=NOW - timedelta(days=112)), NOW)
        stale = compute_health(_inputs(last_event_at=NOW - timedelta(days=200)), NOW)
        assert _points(recent, "event_momentum") == 20
        assert 0 < _points(mid, "event_momentum") < 20
        assert _points(stale, "event_momentum") == 0

    def test_event_data_unavailable_rescales_and_flags_partial(self):
        r = compute_health(
            _inputs(events_available=False, articles_last_year=4,
                    last_article_on=TODAY, people=4, has_lead=True),
            NOW,
        )
        assert r.partial is True
        assert r.score == 100  # full marks on everything we could measure
        assert all(c.available is False for c in r.components if c.key.startswith("event_"))


class TestArticlesAndHosts:
    def test_article_output_and_recency(self):
        r = compute_health(_inputs(articles_last_year=2, last_article_on=TODAY - timedelta(days=60)), NOW)
        assert _points(r, "article_output") == 7.5
        assert _points(r, "article_recency") == 10
        old = compute_health(_inputs(last_article_on=TODAY - timedelta(days=400)), NOW)
        assert _points(old, "article_recency") == 0

    def test_hosts_bench_and_lead(self):
        r = compute_health(_inputs(people=2, has_lead=True), NOW)
        assert _points(r, "host_bench") == 10
        assert _points(r, "host_lead") == 10
        assert _points(compute_health(_inputs(people=3), NOW), "host_lead") == 0

    def test_component_details_are_human_readable(self):
        r = compute_health(_inputs(events_last_year=1, last_event_at=NOW - timedelta(days=5), people=1), NOW)
        details = {c.key: c.detail for c in r.components}
        assert details["event_cadence"] == "1 event in the last 12 months (target 6)"
        assert details["event_momentum"] == "Last event 5 days ago"
        assert details["host_bench"] == "1 active host or lead (target 4)"
        assert details["host_lead"] == "No active chapter lead"
        assert details["article_recency"] == "No published articles yet"


class TestEndpoint:
    async def test_community_stats_includes_events_and_health(
        self, client, admin_headers, db_session, sf_chapter, monkeypatch
    ):
        from app.models.article import Article, ArticleStatus
        from app.models.user import User, UserRole
        from app.core.security import hash_password
        from app.services import luma_events

        sf_chapter.calendar_embed = "https://lu.ma/embed/calendar/cal-T/events?tag=sf"
        db_session.add(sf_chapter)
        db_session.add(Article(chapter_id=sf_chapter.id, title="A", status=ArticleStatus.published,
                               publish_date=date.today() - timedelta(days=10)))
        db_session.add(Article(chapter_id=sf_chapter.id, title="D", status=ArticleStatus.draft))
        db_session.add(User(email="lead@x", username="lead", name="Lea Lead",
                            hashed_password=hash_password("x"), role=UserRole.chapter_lead,
                            chapter_id=sf_chapter.id, is_active=True))
        # Nameless system login: not a person, must not count as a host.
        db_session.add(User(email="sf@aisalon.xyz", username="sfghost",
                            hashed_password=hash_password("x"), role=UserRole.chapter_lead,
                            chapter_id=sf_chapter.id, is_active=True))
        await db_session.commit()

        def ev(i, days):
            return luma_events.LumaEvent(
                id=f"e{i}", name=f"E{i}", start_at=(datetime.now(timezone.utc) + timedelta(days=days)).isoformat(),
                end_at=None, timezone="UTC", url="u", cover_url=None, city=None, tags=["SF"], guest_count=None)

        past = [ev(1, -20), ev(2, -100), ev(3, -500)]
        future = [ev(4, 15)]

        async def fake_events_for(source, period):
            return past if period == "past" else future

        monkeypatch.setattr(luma_events, "events_for", fake_events_for)

        r = await client.get("/admin/community-stats", headers=admin_headers)
        assert r.status_code == 200
        sf = r.json()["chapters"][0]
        assert sf["past_events"] == 3
        assert sf["events_last_year"] == 2
        assert sf["upcoming_events"] == 1
        assert sf["last_event_at"].startswith(past[0].start_at[:10])
        assert sf["next_event_at"].startswith(future[0].start_at[:10])
        assert sf["hosts_count"] == 1
        health = sf["health"]
        assert 0 <= health["score"] <= 100
        assert health["label"] in {"Thriving", "Steady", "Needs attention", "At risk"}
        assert {c["key"] for c in health["components"]} == {
            "event_cadence", "event_momentum", "article_output",
            "article_recency", "host_bench", "host_lead",
        }
        totals = r.json()["totals"]
        assert totals["past_events"] == 3
        assert totals["upcoming_events"] == 1

    async def test_luma_down_still_returns_stats(
        self, client, admin_headers, db_session, sf_chapter, monkeypatch
    ):
        from app.services import luma_events

        sf_chapter.calendar_embed = "https://lu.ma/embed/calendar/cal-T/events?tag=sf"
        db_session.add(sf_chapter)
        await db_session.commit()

        async def boom(source, period):
            raise luma_events.EventsUnavailable("down")

        monkeypatch.setattr(luma_events, "events_for", boom)
        r = await client.get("/admin/community-stats", headers=admin_headers)
        assert r.status_code == 200
        sf = r.json()["chapters"][0]
        assert sf["events_available"] is False
        assert sf["health"]["partial"] is True
