import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getArticle(token: string, id: string) {
  const r = await fetch(`${API_URL}/admin/articles/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch article");
  return r.json();
}

// Minimal markdown → HTML renderer (headings, paragraphs, bold, italic, code)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#{4}\s(.+)$/gm, "<h4>$1</h4>")
    .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[h1-6|p|ul|ol])/m, "<p>")
    + "</p>";
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const article = await getArticle(token, id);
  if (!article) notFound();

  const html = renderMarkdown(article.content_md ?? "");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 30px" }}>
      {/* Back link */}
      <Link
        href="/articles"
        style={{ fontSize: 13, color: "#56a1d2", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}
      >
        <i className="fa fa-arrow-left" />
        All articles
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 9px",
              borderRadius: 12,
              background: article.status === "published" ? "#dcfce7" : "#f3f4f6",
              color: article.status === "published" ? "#16a34a" : "#6b7280",
              textTransform: "capitalize",
            }}
          >
            {article.status}
          </span>
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            {new Date(article.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#111", margin: 0, lineHeight: 1.25 }}>
          {article.title}
        </h1>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 36 }}>
        <a
          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(article.content_md ?? "")}`}
          download={`${article.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "7px 16px",
            borderRadius: 6,
            border: "1.5px solid #56a1d2",
            color: "#56a1d2",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="fa fa-download" />
          Download .md
        </a>
      </div>

      {/* Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: "36px 40px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          lineHeight: 1.75,
          fontSize: 15,
          color: "#222",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
