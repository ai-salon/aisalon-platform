"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PublishingArticle {
  id: string;
  title: string;
  chapter_name: string;
  status: string;
  scheduled_publish_date: string | null;
  substack_url: string | null;
  created_at: string;
}

interface PublishingResponse {
  drafts: PublishingArticle[];
  scheduled: PublishingArticle[];
  published: PublishingArticle[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f3f4f6", color: "#6b7280" },
    scheduled: { bg: "#fef3c7", color: "#d97706" },
    published: { bg: "#dcfce7", color: "#16a34a" },
  };
  const c = colors[status] ?? colors.draft;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 9px",
        borderRadius: 12,
        background: c.bg,
        color: c.color,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function ArticleCard({
  article,
  token,
  onRefresh,
}: {
  article: PublishingArticle;
  token: string;
  onRefresh: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSchedule() {
    if (!date) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/admin/articles/${article.id}/schedule-substack`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_date: date }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || "Failed to schedule");
      } else {
        setScheduling(false);
        onRefresh();
      }
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  async function handlePublishNow() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/admin/articles/${article.id}/publish-substack`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || "Failed to publish");
      } else {
        onRefresh();
      }
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "16px 20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link
              href={`/articles/${article.id}`}
              style={{ fontSize: 15, fontWeight: 700, color: "#111", textDecoration: "none" }}
            >
              {article.title}
            </Link>
            <StatusBadge status={article.status} />
          </div>
          <div style={{ fontSize: 12, color: "#696969" }}>
            {article.chapter_name} · {new Date(article.created_at).toLocaleDateString()}
            {article.scheduled_publish_date && (
              <span style={{ color: "#d97706", fontWeight: 600 }}>
                {" "}· Scheduled: {article.scheduled_publish_date}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {article.status === "draft" && !scheduling && (
            <>
              <button
                onClick={() => setScheduling(true)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#fef3c7",
                  color: "#d97706",
                  border: "1.5px solid #fbbf24",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Schedule
              </button>
              <button
                onClick={handlePublishNow}
                disabled={busy}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#56a1d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Publishing…" : "Publish Now"}
              </button>
            </>
          )}
          {article.status === "published" && article.substack_url && (
            <a
              href={article.substack_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "#56a1d2",
                border: "1.5px solid #56a1d2",
                borderRadius: 6,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              View on Substack <i className="fa fa-external-link" style={{ fontSize: 10 }} />
            </a>
          )}
        </div>
      </div>

      {scheduling && (
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "7px 12px",
              fontSize: 13,
              border: "1.5px solid #d1d5db",
              borderRadius: 6,
              outline: "none",
            }}
          />
          <button
            onClick={handleSchedule}
            disabled={busy || !date}
            style={{
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 700,
              background: "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Scheduling…" : "Confirm Schedule"}
          </button>
          <button
            onClick={() => { setScheduling(false); setDate(""); setError(""); }}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              background: "transparent",
              border: "1.5px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              color: "#696969",
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{error}</p>}
    </div>
  );
}

export default function PublishingPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<PublishingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  function loadData() {
    if (!token) return;
    fetch(`${API_URL}/admin/publishing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [token]);

  if (status === "loading" || loading) return null;
  if (!data) return <p style={{ padding: 40, color: "#696969" }}>Failed to load publishing data.</p>;

  const sections = [
    { title: "Drafts", subtitle: "Unpublished articles ready for scheduling", articles: data.drafts, icon: "fa-file-text-o" },
    { title: "Scheduled", subtitle: "Queued for Substack publishing", articles: data.scheduled, icon: "fa-clock-o" },
    { title: "Published", subtitle: "Live on Substack", articles: data.published, icon: "fa-check-circle" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Publishing</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 36 }}>
        Manage Substack publishing for your articles.
      </p>

      {sections.map(({ title, subtitle, articles, icon }) => (
        <div key={title} style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <i className={`fa ${icon}`} style={{ color: "#56a1d2", fontSize: 15 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>
              {title}
              <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
                ({articles.length})
              </span>
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "#696969", marginBottom: 14 }}>{subtitle}</p>

          {articles.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic", padding: "10px 0" }}>
              No articles in this category.
            </p>
          ) : (
            articles.map((a) => (
              <ArticleCard key={a.id} article={a} token={token} onRefresh={loadData} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}
