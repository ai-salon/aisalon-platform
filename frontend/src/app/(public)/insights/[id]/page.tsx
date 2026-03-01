import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getArticle(id: string) {
  const r = await fetch(`${API_URL}/articles/${id}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch article");
  return r.json();
}

async function getChapter(id: string) {
  const r = await fetch(`${API_URL}/chapters/${id}`, { cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return { title: "Insight – Ai Salon" };
  return { title: `${article.title} – Ai Salon` };
}

// Minimal markdown → safe HTML (no external deps needed at this scale)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .split(/\n\n+/)
    .map((block) => block.startsWith("<h") ? block : `<p>${block}</p>`)
    .join("\n");
}

export default async function InsightArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  const chapter = await getChapter(article.chapter_id);
  const html = renderMarkdown(article.content_md ?? "");

  return (
    <div>
      {/* Header */}
      <section style={{ background: "#f8f6ec", padding: "60px 30px 48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Link
            href="/insights"
            style={{ fontSize: 13, color: "#56a1d2", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}
          >
            <i className="fa fa-arrow-left" aria-hidden="true" /> All insights
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            {chapter && (
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#d2b356" }}>
                {chapter.name}
              </span>
            )}
            <span style={{ fontSize: 12, color: "#9ca3af" }}>·</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {new Date(article.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: "#111", margin: 0, lineHeight: 1.2 }}>
            {article.title}
          </h1>
        </div>
      </section>

      {/* Body */}
      <section style={{ padding: "56px 30px 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              color: "#2a2a2a",
            }}
            className="article-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </section>
    </div>
  );
}
