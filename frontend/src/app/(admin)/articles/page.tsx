"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:     { bg: "#f3f4f6", color: "#6b7280" },
  published: { bg: "#dcfce7", color: "#16a34a" },
};

type Article = {
  id: string;
  title: string;
  status: string;
  chapter_id: string;
  created_at: string;
  anonymized_transcript?: string | null;
};

type Tab = "articles" | "transcripts";

export default function ArticlesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<Tab>("articles");
  const [deleting, setDeleting] = useState<string | null>(null);

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    fetchArticles();
  }, [token]);

  function fetchArticles() {
    fetch(`${API_URL}/admin/articles`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    } as RequestInit)
      .then((r) => r.json())
      .then(setArticles)
      .catch(() => {});
  }

  async function handleDelete(e: React.MouseEvent, article: Article) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    setDeleting(article.id);
    try {
      const r = await fetch(`${API_URL}/admin/articles/${article.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
      }
    } finally {
      setDeleting(null);
    }
  }

  if (status === "loading") return null;

  const transcripts = articles.filter((a) => !!a.anonymized_transcript);
  const visibleArticles = tab === "transcripts" ? transcripts : articles;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Articles</h1>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #f0ebe0",
          marginBottom: 24,
        }}
      >
        {(
          [
            { id: "articles" as Tab, label: "Articles", count: articles.length },
            { id: "transcripts" as Tab, label: "Transcripts", count: transcripts.length },
          ]
        ).map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "9px 20px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              borderBottom: tab === id ? "2px solid #56a1d2" : "2px solid transparent",
              marginBottom: -2,
              background: "transparent",
              color: tab === id ? "#56a1d2" : "#696969",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.15s",
            }}
          >
            {label}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: 10,
                background: tab === id ? "#eff6ff" : "#f3f4f6",
                color: tab === id ? "#56a1d2" : "#6b7280",
              }}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {visibleArticles.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "60px 24px",
            textAlign: "center",
            color: "#696969",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <i className="fa fa-file-text-o" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {tab === "transcripts"
              ? "No transcripts yet. They appear after processing completes."
              : "No articles yet. They'll appear here once jobs complete."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleArticles.map((article) => {
            const style = STATUS_STYLES[article.status] ?? STATUS_STYLES.draft;
            const href =
              tab === "transcripts"
                ? `/articles/${article.id}?tab=transcript`
                : `/articles/${article.id}`;
            return (
              <Link key={article.id} href={href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    padding: "18px 24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "box-shadow 0.15s",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
                      {article.title}
                    </h3>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      {new Date(article.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {tab === "transcripts" && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 12,
                          background: "#f0f9ff",
                          color: "#0369a1",
                          flexShrink: 0,
                        }}
                      >
                        transcript
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: style.bg,
                        color: style.color,
                        textTransform: "capitalize",
                        flexShrink: 0,
                      }}
                    >
                      {article.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, article)}
                      disabled={deleting === article.id}
                      title="Delete"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: deleting === article.id ? "default" : "pointer",
                        padding: "4px 8px",
                        borderRadius: 6,
                        color: "#9ca3af",
                        fontSize: 15,
                        transition: "color 0.15s, background 0.15s",
                        opacity: deleting === article.id ? 0.4 : 1,
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                        e.currentTarget.style.background = "#fef2f2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#9ca3af";
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      <i className="fa fa-trash-o" />
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
