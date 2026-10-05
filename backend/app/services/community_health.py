"""Chapter community health: a 0–100 score from events, articles and hosts.

Weights and targets are calibrated to a small volunteer-run chapter, not to SF:
a salon every other month, a few articles a year, and a handful of hosts is a
healthy chapter. Everything looks back 12 months because activity is sparse.

    Events   45  cadence 25 (events in last 12 months, target 6)
                 momentum 20 (event scheduled, or last event ≤45 days ago;
                              fades to 0 at 180 days)
    Articles 25  output 15 (published in last 12 months, target 4)
                 recency 10 (last published ≤90 days ago; fades to 0 at 365)
    Hosts    30  bench 20 (active named leads + hosts, target 4)
                 lead 10 (has an active, named chapter lead)

When Luma is unreachable the event components are marked unavailable and the
score is rescaled over what could be measured (``partial``), so an outage
doesn't make every chapter look unhealthy.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

EVENTS_TARGET = 6
ARTICLES_TARGET = 4
PEOPLE_TARGET = 4
MOMENTUM_FULL_DAYS, MOMENTUM_ZERO_DAYS = 45, 180
ARTICLE_FULL_DAYS, ARTICLE_ZERO_DAYS = 90, 365


@dataclass(frozen=True)
class HealthInputs:
    events_last_year: int
    last_event_at: datetime | None
    upcoming_events: int
    events_available: bool
    articles_last_year: int
    last_article_on: date | None
    people: int
    has_lead: bool


@dataclass(frozen=True)
class HealthComponent:
    key: str
    group: str  # "Events" | "Articles" | "Hosts"
    label: str
    points: float
    max_points: int
    detail: str
    available: bool = True


@dataclass(frozen=True)
class HealthResult:
    score: int
    label: str
    partial: bool
    components: list[HealthComponent]


def label_for(score: int) -> str:
    if score >= 75:
        return "Thriving"
    if score >= 50:
        return "Steady"
    if score >= 25:
        return "Needs attention"
    return "At risk"


def _ratio(n: float, target: float) -> float:
    return max(0.0, min(n / target, 1.0))


def _fade(days: int, full: int, zero: int) -> float:
    """1.0 up to ``full`` days, linearly down to 0.0 at ``zero`` days."""
    if days <= full:
        return 1.0
    if days >= zero:
        return 0.0
    return (zero - days) / (zero - full)


def _ago(days: int) -> str:
    if days <= 0:
        return "today"
    return "1 day ago" if days == 1 else f"{days} days ago"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def compute_health(i: HealthInputs, now: datetime) -> HealthResult:
    comps: list[HealthComponent] = []

    # ── Events ──
    comps.append(HealthComponent(
        key="event_cadence", group="Events", label="Event cadence",
        points=round(25 * _ratio(i.events_last_year, EVENTS_TARGET), 1), max_points=25,
        detail=f"{_plural(i.events_last_year, 'event')} in the last 12 months (target {EVENTS_TARGET})",
        available=i.events_available,
    ))
    if i.upcoming_events:
        momentum, detail = 1.0, f"{_plural(i.upcoming_events, 'upcoming event')} scheduled"
    elif i.last_event_at:
        days = (now - i.last_event_at).days
        momentum, detail = _fade(days, MOMENTUM_FULL_DAYS, MOMENTUM_ZERO_DAYS), f"Last event {_ago(days)}"
    else:
        momentum, detail = 0.0, "No events yet"
    comps.append(HealthComponent(
        key="event_momentum", group="Events", label="Event momentum",
        points=round(20 * momentum, 1), max_points=20, detail=detail,
        available=i.events_available,
    ))

    # ── Articles ──
    comps.append(HealthComponent(
        key="article_output", group="Articles", label="Articles published",
        points=round(15 * _ratio(i.articles_last_year, ARTICLES_TARGET), 1), max_points=15,
        detail=f"{_plural(i.articles_last_year, 'article')} in the last 12 months (target {ARTICLES_TARGET})",
    ))
    if i.last_article_on:
        days = (now.date() - i.last_article_on).days
        recency, detail = _fade(days, ARTICLE_FULL_DAYS, ARTICLE_ZERO_DAYS), f"Last article {_ago(days)}"
    else:
        recency, detail = 0.0, "No published articles yet"
    comps.append(HealthComponent(
        key="article_recency", group="Articles", label="Article recency",
        points=round(10 * recency, 1), max_points=10, detail=detail,
    ))

    # ── Hosts ──
    comps.append(HealthComponent(
        key="host_bench", group="Hosts", label="Host bench",
        points=round(20 * _ratio(i.people, PEOPLE_TARGET), 1), max_points=20,
        detail=f"{i.people} active host{'' if i.people == 1 else 's'} or lead{'' if i.people == 1 else 's'} (target {PEOPLE_TARGET})",
    ))
    comps.append(HealthComponent(
        key="host_lead", group="Hosts", label="Chapter lead",
        points=10.0 if i.has_lead else 0.0, max_points=10,
        detail="Has an active chapter lead" if i.has_lead else "No active chapter lead",
    ))

    measured = [c for c in comps if c.available]
    earned = sum(c.points for c in measured)
    possible = sum(c.max_points for c in measured)
    score = round(100 * earned / possible) if possible else 0
    return HealthResult(
        score=score,
        label=label_for(score),
        partial=len(measured) < len(comps),
        components=comps,
    )
