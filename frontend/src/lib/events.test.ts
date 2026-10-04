import { describe, expect, it } from "vitest";
import {
  daysAgo,
  eventYears,
  formatEventDate,
  groupByDay,
  localDayKey,
  monthGrid,
  pastEventsLink,
  relativeDays,
  summarize,
} from "./events";

describe("localDayKey", () => {
  it("uses the event's own timezone, not UTC", () => {
    // 01:30 UTC on Sep 18 is the evening of Sep 17 in Vancouver.
    expect(localDayKey({ start_at: "2026-09-18T01:30:00.000Z", timezone: "America/Vancouver" })).toBe(
      "2026-09-17",
    );
  });

  it("falls back gracefully on a bad timezone", () => {
    expect(localDayKey({ start_at: "2026-06-20T12:00:00.000Z", timezone: "Not/AZone" })).toMatch(
      /^2026-06-2[01]$/,
    );
  });
});

describe("formatEventDate", () => {
  it("formats in the event timezone", () => {
    expect(formatEventDate({ start_at: "2026-09-18T01:30:00.000Z", timezone: "America/Vancouver" })).toBe(
      "Sep 17, 2026",
    );
  });
});

describe("groupByDay", () => {
  it("buckets same-day events together", () => {
    const g = groupByDay([
      { start_at: "2026-06-20T17:00:00.000Z", timezone: "UTC" },
      { start_at: "2026-06-20T19:00:00.000Z", timezone: "UTC" },
      { start_at: "2026-06-21T19:00:00.000Z", timezone: "UTC" },
    ]);
    expect(g.get("2026-06-20")).toHaveLength(2);
    expect(g.get("2026-06-21")).toHaveLength(1);
  });
});

describe("summarize", () => {
  it("counts and picks last past + next upcoming", () => {
    const s = summarize([
      { start_at: "2026-01-01T00:00:00Z", is_past: true },
      { start_at: "2026-06-01T00:00:00Z", is_past: true },
      { start_at: "2026-12-01T00:00:00Z", is_past: false },
      { start_at: "2026-11-01T00:00:00Z", is_past: false },
    ]);
    expect(s.pastCount).toBe(2);
    expect(s.upcomingCount).toBe(2);
    expect(s.last?.start_at).toBe("2026-06-01T00:00:00Z");
    expect(s.next?.start_at).toBe("2026-11-01T00:00:00Z");
  });

  it("handles no events", () => {
    expect(summarize([])).toEqual({ pastCount: 0, upcomingCount: 0, last: null, next: null });
  });
});

describe("daysAgo / relativeDays", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  it("past and future", () => {
    expect(daysAgo("2026-10-01T12:00:00Z", now)).toBe(3);
    expect(relativeDays("2026-10-01T12:00:00Z", now)).toBe("3 days ago");
    expect(relativeDays("2026-10-08T13:00:00Z", now)).toBe("in 4 days");
    expect(relativeDays("2026-10-04T09:00:00Z", now)).toBe("today");
  });
});

describe("monthGrid", () => {
  it("pads to full Sunday-first weeks", () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthGrid(2026, 9);
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe("eventYears", () => {
  it("includes the current year and every event year", () => {
    expect(
      eventYears(
        [
          { start_at: "2023-05-07T20:00:00Z", timezone: "UTC" },
          { start_at: "2025-01-01T20:00:00Z", timezone: "UTC" },
        ],
        2026,
      ),
    ).toEqual([2023, 2025, 2026]);
  });
});

describe("pastEventsLink", () => {
  it("adds period=past and keeps the tag", () => {
    expect(pastEventsLink("https://lu.ma/Ai-salon?tag=sf")).toBe("https://lu.ma/Ai-salon?tag=sf&period=past");
  });
  it("returns null for junk", () => {
    expect(pastEventsLink("")).toBeNull();
  });
});
