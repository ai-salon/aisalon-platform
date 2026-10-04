// Shared helpers for Luma events (public chapter page + admin Events page).

export type SalonEvent = {
  id: string;
  name: string;
  start_at: string; // ISO 8601 UTC
  end_at: string | null;
  timezone: string | null;
  url: string;
  cover_url: string | null;
  city: string | null;
  guest_count: number | null;
};

export type AdminEvent = SalonEvent & {
  chapter_id: string;
  chapter_code: string;
  chapter_name: string;
  is_past: boolean;
};

export type EventsChapter = {
  id: string;
  code: string;
  name: string;
  status: string;
  luma_tag: string | null;
  has_calendar: boolean;
  tag_matched: boolean;
};

export type AdminEventsResponse = {
  chapters: EventsChapter[];
  events: AdminEvent[];
  error: string | null;
};

function safeZone(tz: string | null): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** "YYYY-MM-DD" of the event's start, in the event's own timezone. */
export function localDayKey(e: Pick<SalonEvent, "start_at" | "timezone">): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(e.timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(e.start_at));
}

/** "Jun 20, 2026" in the event's own timezone. */
export function formatEventDate(e: Pick<SalonEvent, "start_at" | "timezone">): string {
  return new Date(e.start_at).toLocaleDateString("en-US", {
    timeZone: safeZone(e.timezone),
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function groupByDay<T extends Pick<SalonEvent, "start_at" | "timezone">>(
  events: T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const e of events) {
    const k = localDayKey(e);
    const list = out.get(k);
    if (list) list.push(e);
    else out.set(k, [e]);
  }
  return out;
}

export type EventSummary<T> = {
  pastCount: number;
  upcomingCount: number;
  last: T | null; // most recent past event
  next: T | null; // soonest upcoming event
};

export function summarize<T extends Pick<AdminEvent, "start_at" | "is_past">>(
  events: T[],
): EventSummary<T> {
  const past = events.filter((e) => e.is_past);
  const upcoming = events.filter((e) => !e.is_past);
  const byStart = (a: T, b: T) => a.start_at.localeCompare(b.start_at);
  past.sort(byStart);
  upcoming.sort(byStart);
  return {
    pastCount: past.length,
    upcomingCount: upcoming.length,
    last: past.at(-1) ?? null,
    next: upcoming[0] ?? null,
  };
}

/** Whole days between an ISO instant and now (positive = in the past). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  return Math.trunc((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function relativeDays(iso: string, now: Date = new Date()): string {
  const d = daysAgo(iso, now);
  if (d === 0) return "today";
  if (d > 0) return d === 1 ? "yesterday" : `${d} days ago`;
  return d === -1 ? "tomorrow" : `in ${-d} days`;
}

/**
 * Weeks of a month for a Sunday-first calendar grid. Each cell is a
 * "YYYY-MM-DD" key, or null for padding outside the month.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  const mm = String(month + 1).padStart(2, "0");
  for (let d = 1; d <= days; d++) cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Years that contain at least one event, ascending, always including `current`. */
export function eventYears(events: Pick<SalonEvent, "start_at" | "timezone">[], current: number): number[] {
  const years = new Set<number>([current]);
  for (const e of events) years.add(Number(localDayKey(e).slice(0, 4)));
  return [...years].sort((a, b) => a - b);
}

/** Link to a chapter's past events on Luma, derived from its event link. */
export function pastEventsLink(eventLink: string): string | null {
  try {
    const u = new URL(eventLink);
    u.searchParams.set("period", "past");
    return u.toString();
  } catch {
    return null;
  }
}
