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
        borderRadius: 10,
        padding: "22px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        flex: "1 1 0",
        minWidth: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <i className={`fa ${icon}`} style={{ color, fontSize: 16 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#696969", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#111" }}>{value}</div>
    </div>
  );
}

function ChapterCard({ stats }: { stats: ChapterStats }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#eef6fd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="fa fa-map-marker" style={{ color: "#56a1d2", fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{stats.chapter_name}</div>
          <div style={{ fontSize: 12, color: "#696969" }}>{stats.chapter_code}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Articles</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{stats.articles_count}</div>
          <div style={{ fontSize: 11, color: "#696969" }}>
            {stats.published_count} published · {stats.draft_count} draft
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Jobs</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{stats.jobs_count}</div>
          <div style={{ fontSize: 11, color: "#696969" }}>
            {stats.completed_jobs} completed · {stats.failed_jobs} failed
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Team</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{stats.team_size}</div>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<CommunityStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const token = (session as any)?.accessToken;

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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Community</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 32 }}>
        Activity across {chapters.length === 1 ? "your chapter" : `${chapters.length} chapters`}.
      </p>

      {/* Totals bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
        <StatCard label="Total Articles" value={totals.articles_count} icon="fa-file-text-o" color="#56a1d2" />
        <StatCard label="Total Jobs" value={totals.jobs_count} icon="fa-cogs" color="#d2b356" />
        <StatCard label="Team Members" value={totals.team_size} icon="fa-users" color="#16a34a" />
        <StatCard label="Active Chapters" value={chapters.length} icon="fa-map-marker" color="#8b5cf6" />
      </div>

      {/* Per-chapter breakdown */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>
        {chapters.length === 1 ? "Your Chapter" : "By Chapter"}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))", gap: 16 }}>
        {chapters.map((ch) => (
          <ChapterCard key={ch.chapter_code} stats={ch} />
        ))}
      </div>
    </div>
  );
}
