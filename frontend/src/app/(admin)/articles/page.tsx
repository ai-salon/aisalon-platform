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
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    fetchArticles();
    fetch(`${API_URL}/admin/chapters`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data: { id: string; name: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setChapters(data.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
    fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.ok) setIsSuperadmin(true); })
      .catch(() => {});
  }, [token]);

  function fetchArticles() {
    fetch(`${API_URL}/admin/articles`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    } as RequestInit)
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data) => setArticles(Array.isArray(data) ? data : []))
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

  async function handleLinkArticle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const body: Record<string, string> = {
        title: form.title,
        substack_url: form.substackUrl,
      };
      if (form.publishedDate) body.published_date = form.publishedDate;
      if (isSuperadmin && form.chapterId) body.chapter_id = form.chapterId;
      const r = await fetch(`${API_URL}/admin/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setModalError(err?.detail ?? "Failed to link article.");
        return;
      }
      const created = await r.json();
      setArticles((prev) => [created, ...prev]);
      setShowModal(false);
      setForm({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return null;

  const transcripts = articles.filter((a) => !!a.anonymized_transcript);
  const visibleArticles = tab === "transcripts" ? transcripts : articles;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Articles</h1>
        <button
          type="button"
          onClick={() => {
            setShowModal(true);
            setForm({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
            setModalError(null);
            setSubmitting(false);
          }}
          style={{
            background: "#56a1d2",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Link Article
        </button>
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
          <div style={{ fontSize: 14 }}>
            {tab === "transcripts" ? (
              <>
                Transcripts appear here after a conversation is processed.{" "}
                <Link href="/upload" style={{ color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}>
                  Go to Upload →
                </Link>
              </>
            ) : (
              <>
                No articles yet.{" "}
                <Link href="/upload" style={{ color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}>
                  Upload a conversation →
                </Link>{" "}
                to generate your first one.
              </>
            )}
          </div>
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
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
          }}
          onClick={() => {
            setShowModal(false);
            setForm({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
            setModalError(null);
            setSubmitting(false);
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: "32px 28px",
              width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 20px" }}>
              Link Existing Article
            </h2>
            <form onSubmit={handleLinkArticle} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="link-title" style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Title *
                </label>
                <input
                  id="link-title"
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label htmlFor="link-substack-url" style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Substack URL *
                </label>
                <input
                  id="link-substack-url"
                  required
                  type="url"
                  value={form.substackUrl}
                  onChange={(e) => setForm((f) => ({ ...f, substackUrl: e.target.value }))}
                  placeholder="https://yourpublication.substack.com/p/..."
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label htmlFor="link-published-date" style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Publish Date
                </label>
                <input
                  id="link-published-date"
                  type="date"
                  value={form.publishedDate}
                  onChange={(e) => setForm((f) => ({ ...f, publishedDate: e.target.value }))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              {isSuperadmin && (
                <div>
                  <label htmlFor="link-chapter-id" style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                    Chapter *
                  </label>
                  <select
                    id="link-chapter-id"
                    required
                    value={form.chapterId}
                    onChange={(e) => setForm((f) => ({ ...f, chapterId: e.target.value }))}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 6,
                      border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="">Select a chapter…</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalError && (
                <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{modalError}</p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setForm({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
                    setModalError(null);
                    setSubmitting(false);
                  }}
                  style={{
                    background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8,
                    padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#696969",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: submitting ? "#93c5e8" : "#56a1d2",
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "8px 18px", fontSize: 13, fontWeight: 700,
                    cursor: submitting ? "default" : "pointer",
                  }}
                >
                  {submitting ? "Linking…" : "Link Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
