"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  type AdminEvent,
  type AdminEventsResponse,
  type EventsChapter,
  eventYears,
  formatEventDate,
  groupByDay,
  localDayKey,
  monthGrid,
  relativeDays,
  summarize,
} from "@/lib/events";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const BLUE = "#56a1d2";
const GOLD = "#d2b356";
const MUTED = "#696969";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  padding: "18px 20px",
};

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div style={{ ...card, flex: "1 1 200px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: MUTED, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111", marginTop: 6 }}>{value}</div>
      {detail && (
        <div
          style={{ fontSize: 13, color: MUTED, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={detail}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

function ChapterTable({ chapters, events }: { chapters: EventsChapter[]; events: AdminEvent[] }) {
  const rows = chapters.map((c) => ({ c, s: summarize(events.filter((e) => e.chapter_id === c.id)) }));
  rows.sort((a, b) => (b.s.last?.start_at ?? "").localeCompare(a.s.last?.start_at ?? ""));
  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: MUTED,
    padding: "10px 14px",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: 14, color: "#374151", borderTop: "1px solid #f0f0f0" };
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>
            <th style={th}>Chapter</th>
            <th style={th}>Last event</th>
            <th style={th}>Past</th>
            <th style={th}>Upcoming</th>
            <th style={th}>Next event</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, s }) => (
            <tr key={c.id}>
              <td style={{ ...td, fontWeight: 600, color: "#111" }}>
                {c.name}
                {c.status !== "active" && <span style={{ color: MUTED, fontWeight: 400 }}> ({c.status})</span>}
              </td>
              <td style={td}>
                {s.last ? (
                  <>
                    {formatEventDate(s.last)}{" "}
                    <span style={{ color: MUTED }}>({relativeDays(s.last.start_at)})</span>
                  </>
                ) : (
                  <span style={{ color: MUTED }}>None</span>
                )}
              </td>
              <td style={td}>{s.pastCount}</td>
              <td style={td}>{s.upcomingCount}</td>
              <td style={td}>
                {s.next ? (
                  <a href={s.next.url} target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: "none" }}>
                    {formatEventDate(s.next)}
                  </a>
                ) : (
                  <span style={{ color: MUTED }}>Nothing scheduled</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniMonth({
  year,
  month,
  byDay,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  byDay: Map<string, AdminEvent[]>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const weeks = monthGrid(year, month);
  const count = weeks.flat().reduce((n, d) => n + (d ? byDay.get(d)?.length ?? 0 : 0), 0);
  return (
    <div style={{ ...card, padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{MONTHS[month]}</span>
        <span style={{ fontSize: 12, color: count ? "#111" : "#c4c4c4", fontWeight: count ? 600 : 400 }}>
          {count ? `${count} event${count === 1 ? "" : "s"}` : "—"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: "#b0b0b0", paddingBottom: 2 }}>
            {d}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          if (!day) return <div key={i} />;
          const evs = byDay.get(day);
          const n = Number(day.slice(8));
          if (!evs) {
            return (
              <div key={i} style={{ fontSize: 11, color: "#9ca3af", lineHeight: "24px" }}>
                {n}
              </div>
            );
          }
          const upcoming = evs.some((e) => !e.is_past);
          const isSel = selected === day;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isSel ? null : day)}
              title={evs.map((e) => `${e.name}${e.chapter_name ? ` (${e.chapter_name})` : ""}`).join("\n")}
              aria-label={`${day}: ${evs.length} event${evs.length === 1 ? "" : "s"}`}
              aria-pressed={isSel}
              style={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "24px",
                border: isSel ? "2px solid #111" : "2px solid transparent",
                borderRadius: "50%",
                background: upcoming ? GOLD : BLUE,
                color: "#fff",
                cursor: "pointer",
                padding: 0,
                width: 28,
                height: 28,
                margin: "0 auto",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// "Zürich" and "Zurich" are the same place for display purposes.
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function EventRow({ e, showChapter }: { e: AdminEvent; showChapter: boolean }) {
  return (
    <a
      href={e.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        borderTop: "1px solid #f0f0f0",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: e.is_past ? BLUE : GOLD }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{e.name}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          {formatEventDate(e)} · {relativeDays(e.start_at)}
          {showChapter ? ` · ${e.chapter_name}` : ""}
          {e.city && fold(e.city) !== fold(e.chapter_name) ? ` · ${e.city}` : ""}
          {e.guest_count ? ` · ${e.guest_count} guests` : ""}
        </div>
      </div>
      <i className="fa fa-external-link" aria-hidden="true" style={{ color: "#c4c4c4", fontSize: 12 }} />
    </a>
  );
}

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const isSuperadmin = (session as unknown as { user?: { role?: string } })?.user?.role === "superadmin";

  const [data, setData] = useState<AdminEventsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string>("all");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/admin/events`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body: AdminEventsResponse = await r.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setLoadError("Couldn't load events. Please refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const chapters = useMemo(() => data?.chapters ?? [], [data]);
  const events = useMemo(() => {
    const all = data?.events ?? [];
    return chapterId === "all" ? all : all.filter((e) => e.chapter_id === chapterId);
  }, [data, chapterId]);
  const scopedChapters = chapterId === "all" ? chapters : chapters.filter((c) => c.id === chapterId);
  const summary = useMemo(() => summarize(events), [events]);
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => eventYears(events, currentYear), [events, currentYear]);
  const yearEvents = useMemo(() => events.filter((e) => localDayKey(e).startsWith(`${year}-`)), [events, year]);
  const byDay = useMemo(() => groupByDay(yearEvents), [yearEvents]);
  const showChapter = isSuperadmin && chapterId === "all";

  const listed = selectedDay ? byDay.get(selectedDay) ?? [] : yearEvents;
  const upcoming = listed.filter((e) => !e.is_past);
  const past = listed.filter((e) => e.is_past).reverse();
  const problems = scopedChapters.filter((c) => !c.has_calendar || !c.tag_matched);

  const yearIdx = years.indexOf(year);
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 6,
    width: 32,
    height: 32,
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "#d1d5db" : "#374151",
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Events</h1>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 4, marginBottom: 0 }}>
            From the Ai Salon Luma calendar. Refreshes every 10 minutes.
          </p>
        </div>
        {isSuperadmin && chapters.length > 1 && (
          <select
            value={chapterId}
            onChange={(ev) => {
              setChapterId(ev.target.value);
              setSelectedDay(null);
            }}
            aria-label="Chapter"
            style={{ fontSize: 14, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff" }}
          >
            <option value="all">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== "active" ? ` (${c.status})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {(loadError || data?.error) && (
        <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 6, background: "#fef2f2", color: "#991b1b", fontSize: 14 }}>
          {loadError ?? data?.error}
        </div>
      )}

      {!data && !loadError && <p style={{ marginTop: 32, color: MUTED }}>Loading events…</p>}

      {data && (
        <>
          {problems.length > 0 && (
            <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 6, background: "#fdf8ee", color: "#7a5a12", fontSize: 14 }}>
              {problems.map((c) => (
                <div key={c.id}>
                  <strong>{c.name}:</strong>{" "}
                  {!c.has_calendar
                    ? "no Luma calendar is set for this chapter."
                    : `no Luma events are tagged "${c.luma_tag}". Check the tag in the chapter's calendar settings.`}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
            <StatTile
              label="Last event"
              value={summary.last ? relativeDays(summary.last.start_at) : "None yet"}
              detail={summary.last ? `${formatEventDate(summary.last)} · ${summary.last.name}` : undefined}
            />
            <StatTile label="Past events" value={String(summary.pastCount)} />
            <StatTile label="Upcoming" value={String(summary.upcomingCount)} />
            <StatTile
              label="Next event"
              value={summary.next ? relativeDays(summary.next.start_at) : "None scheduled"}
              detail={summary.next ? `${formatEventDate(summary.next)} · ${summary.next.name}` : undefined}
            />
          </div>

          {showChapter && chapters.length > 1 && (
            <div style={{ marginTop: 24 }}>
              <ChapterTable chapters={chapters} events={data.events} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                aria-label="Previous year"
                disabled={yearIdx <= 0}
                onClick={() => {
                  setYear(years[yearIdx - 1]);
                  setSelectedDay(null);
                }}
                style={navBtn(yearIdx <= 0)}
              >
                <i className="fa fa-chevron-left" aria-hidden="true" />
              </button>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: 0, minWidth: 140, textAlign: "center" }}>
                {year} · {yearEvents.length} event{yearEvents.length === 1 ? "" : "s"}
              </h2>
              <button
                type="button"
                aria-label="Next year"
                disabled={yearIdx >= years.length - 1}
                onClick={() => {
                  setYear(years[yearIdx + 1]);
                  setSelectedDay(null);
                }}
                style={navBtn(yearIdx >= years.length - 1)}
              >
                <i className="fa fa-chevron-right" aria-hidden="true" />
              </button>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: MUTED }}>
              <span>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: BLUE, marginRight: 6 }} />
                Past
              </span>
              <span>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: GOLD, marginRight: 6 }} />
                Upcoming
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginTop: 16,
            }}
          >
            {MONTHS.map((_, m) => (
              <MiniMonth key={m} year={year} month={m} byDay={byDay} selected={selectedDay} onSelect={setSelectedDay} />
            ))}
          </div>

          <div style={{ ...card, marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>
                {selectedDay ? `Events on ${formatEventDate(listed[0] ?? { start_at: selectedDay, timezone: "UTC" })}` : `Events in ${year}`}
              </h3>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  style={{ border: "none", background: "none", color: BLUE, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                >
                  Show all of {year}
                </button>
              )}
            </div>
            {listed.length === 0 && <p style={{ color: MUTED, fontSize: 14, margin: "12px 0 0" }}>No events in {year}.</p>}
            {upcoming.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: MUTED, margin: "14px 0 4px" }}>
                  UPCOMING
                </div>
                {upcoming.map((e) => (
                  <EventRow key={`${e.chapter_id}-${e.id}`} e={e} showChapter={showChapter} />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: MUTED, margin: "14px 0 4px" }}>
                  PAST
                </div>
                {past.map((e) => (
                  <EventRow key={`${e.chapter_id}-${e.id}`} e={e} showChapter={showChapter} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
