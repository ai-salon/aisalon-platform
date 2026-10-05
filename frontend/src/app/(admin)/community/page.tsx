"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import HealthBadge, { type ChapterHealth, HEALTH_COLORS } from "@/components/HealthBadge";
import { relativeDays } from "@/lib/events";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ChapterStats {
  chapter_id: string | null;
  chapter_name: string;
  chapter_code: string;
  articles_count: number;
  published_count: number;
  draft_count: number;
  jobs_count: number;
  completed_jobs: number;
  failed_jobs: number;
  team_size: number;
  hosts_count: number;
  past_events: number;
  events_last_year: number;
  upcoming_events: number;
  last_event_at: string | null;
  next_event_at: string | null;
  events_available: boolean;
  health: ChapterHealth | null;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface CommunityStatsResponse {
  chapters: ChapterStats[];
  totals: ChapterStats;
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "14px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        flex: "1 1 0",
        minWidth: 140,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <i className={`fa ${icon}`} style={{ color, fontSize: 18, width: 22, textAlign: "center" }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#696969", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "#222",
  borderBottom: "1px solid #f1f1ec",
  verticalAlign: "middle",
};

const numCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const headerCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  color: "#696969",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid #e8e4d8",
  background: "#fafaf3",
};

const numHeaderStyle: React.CSSProperties = {
  ...headerCellStyle,
  textAlign: "right",
};

export default function CommunityPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<CommunityStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const token = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/community-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (status === "loading" || loading) return null;
  if (!data) return <p style={{ padding: 40, color: "#696969" }}>Failed to load stats.</p>;

  const { totals, chapters } = data;
  const sorted = [...chapters].sort(
    (a, b) => (b.health?.score ?? -1) - (a.health?.score ?? -1) || b.articles_count - a.articles_count,
  );
  const scored = chapters.filter((c) => c.health);
  const avgHealth = scored.length
    ? Math.round(scored.reduce((s, c) => s + (c.health?.score ?? 0), 0) / scored.length)
    : 0;
  const eventsDown = chapters.some((c) => !c.events_available);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>Community</h1>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 24 }}>
        Activity across {chapters.length === 1 ? "your chapter" : `${chapters.length} chapters`}.
      </p>

      {/* Totals bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Chapters" value={chapters.length} icon="fa-map-marker" color="#8b5cf6" />
        <StatCard label="Articles" value={totals.articles_count} icon="fa-file-text-o" color="#56a1d2" />
        <StatCard label="Events, past yr" value={totals.events_last_year} icon="fa-calendar" color="#d2b356" />
        <StatCard label="Upcoming" value={totals.upcoming_events} icon="fa-calendar-plus-o" color="#d2b356" />
        <StatCard label="Hosts & Leads" value={totals.hosts_count} icon="fa-users" color="#16a34a" />
        <StatCard label="Avg Health" value={avgHealth} icon="fa-heartbeat" color="#dc2626" />
      </div>

      {eventsDown && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "#fdf8ee", color: "#7a5a12", fontSize: 13 }}>
          Couldn&apos;t reach Luma, so event counts are missing. Health scores marked * cover articles and hosts only.
        </div>
      )}

      {/* Per-chapter table */}
      {chapters.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "40px 24px",
            textAlign: "center",
            color: "#696969",
            border: "1px solid #ede9d8",
          }}
        >
          <i className="fa fa-bar-chart" style={{ fontSize: 28, color: "#d1d5db", marginBottom: 12, display: "block" }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            No community data yet. Stats appear once you&apos;ve published articles and built your team.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: "left" }}>Chapter</th>
                <th style={{ ...headerCellStyle, textAlign: "left" }}>Health</th>
                <th style={{ ...headerCellStyle, textAlign: "left" }}>Last event</th>
                <th style={numHeaderStyle} title="Events in the last 12 months">Events</th>
                <th style={numHeaderStyle}>Upcoming</th>
                <th style={numHeaderStyle}>Articles</th>
                <th style={numHeaderStyle}>Published</th>
                <th style={numHeaderStyle}>Draft</th>
                <th style={numHeaderStyle} title="Active, named leads and hosts">Hosts</th>
                <th style={numHeaderStyle}>Jobs</th>
                <th style={numHeaderStyle}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ch) => (
                <tr key={ch.chapter_code}>
                  <td style={cellStyle}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600, color: "#111" }}>{ch.chapter_name}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{ch.chapter_code}</span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    {ch.health ? <HealthBadge health={ch.health} /> : <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {!ch.events_available ? (
                      <span style={{ color: "#9ca3af" }}>Unavailable</span>
                    ) : ch.last_event_at ? (
                      <>
                        {shortDate(ch.last_event_at)}
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{relativeDays(ch.last_event_at)}</div>
                      </>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>None</span>
                    )}
                  </td>
                  <td style={numCellStyle}>{ch.events_available ? ch.events_last_year : "—"}</td>
                  <td
                    style={{ ...numCellStyle, color: ch.upcoming_events ? "#111" : "#9ca3af" }}
                    title={ch.next_event_at ? `Next: ${shortDate(ch.next_event_at)}` : undefined}
                  >
                    {ch.events_available ? ch.upcoming_events : "—"}
                  </td>
                  <td style={{ ...numCellStyle, fontWeight: 600 }}>{ch.articles_count}</td>
                  <td style={numCellStyle}>{ch.published_count}</td>
                  <td style={numCellStyle}>{ch.draft_count}</td>
                  <td style={numCellStyle}>{ch.hosts_count}</td>
                  <td style={numCellStyle}>{ch.completed_jobs}</td>
                  <td style={{ ...numCellStyle, color: ch.failed_jobs > 0 ? "#dc2626" : "#9ca3af" }}>
                    {ch.failed_jobs}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#fafaf3" }}>
                <td style={{ ...cellStyle, fontWeight: 700, color: "#111", borderBottom: "none" }}>Total</td>
                <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                  {scored.length > 0 && <span style={{ color: "#696969" }}>Avg {avgHealth}</span>}
                </td>
                <td style={{ ...cellStyle, borderBottom: "none" }} />
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.events_last_year}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.upcoming_events}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.articles_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.published_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.draft_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.hosts_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.completed_jobs}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none", color: totals.failed_jobs > 0 ? "#dc2626" : "#9ca3af" }}>
                  {totals.failed_jobs}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {chapters.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "#696969", lineHeight: 1.6 }}>
          <strong style={{ color: "#374151" }}>Health</strong> is out of 100: events 45 (cadence over the last 12 months
          and how recent or scheduled the next one is), articles 25 (published in the last 12 months and how recently),
          hosts 30 (active leads and hosts, and having a lead). Hover a score for its breakdown.
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
            {Object.entries(HEALTH_COLORS).map(([label, c]) => (
              <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.bar }} />
                {label} {label === "Thriving" ? "75+" : label === "Steady" ? "50–74" : label === "Needs attention" ? "25–49" : "under 25"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
