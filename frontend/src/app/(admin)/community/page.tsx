"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

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
  const sorted = [...chapters].sort((a, b) => b.articles_count - a.articles_count);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>Community</h1>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 24 }}>
        Activity across {chapters.length === 1 ? "your chapter" : `${chapters.length} chapters`}.
      </p>

      {/* Totals bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Chapters" value={chapters.length} icon="fa-map-marker" color="#8b5cf6" />
        <StatCard label="Articles" value={totals.articles_count} icon="fa-file-text-o" color="#56a1d2" />
        <StatCard label="Team Members" value={totals.team_size} icon="fa-users" color="#16a34a" />
        <StatCard label="Completed Jobs" value={totals.completed_jobs} icon="fa-check-circle" color="#d2b356" />
      </div>

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
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: "left" }}>Chapter</th>
                <th style={numHeaderStyle}>Articles</th>
                <th style={numHeaderStyle}>Published</th>
                <th style={numHeaderStyle}>Draft</th>
                <th style={numHeaderStyle}>Team</th>
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
                  <td style={{ ...numCellStyle, fontWeight: 600 }}>{ch.articles_count}</td>
                  <td style={numCellStyle}>{ch.published_count}</td>
                  <td style={numCellStyle}>{ch.draft_count}</td>
                  <td style={numCellStyle}>{ch.team_size}</td>
                  <td style={numCellStyle}>{ch.completed_jobs}</td>
                  <td style={{ ...numCellStyle, color: ch.failed_jobs > 0 ? "#dc2626" : "#9ca3af" }}>
                    {ch.failed_jobs}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#fafaf3" }}>
                <td style={{ ...cellStyle, fontWeight: 700, color: "#111", borderBottom: "none" }}>Total</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.articles_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.published_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.draft_count}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.team_size}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none" }}>{totals.completed_jobs}</td>
                <td style={{ ...numCellStyle, fontWeight: 700, borderBottom: "none", color: totals.failed_jobs > 0 ? "#dc2626" : "#9ca3af" }}>
                  {totals.failed_jobs}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
