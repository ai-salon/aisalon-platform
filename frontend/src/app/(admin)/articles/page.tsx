import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:     { bg: "#f3f4f6", color: "#6b7280" },
  published: { bg: "#dcfce7", color: "#16a34a" },
};

async function getArticles(token: string) {
  const r = await fetch(`${API_URL}/admin/articles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  return r.json();
}

export default async function ArticlesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const articles = await getArticles(token);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Articles</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {articles.length} article{articles.length !== 1 ? "s" : ""}
        </p>
      </div>

      {articles.length === 0 ? (
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
          <p style={{ fontSize: 14, margin: 0 }}>No articles yet. They&#39;ll appear here once jobs complete.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {articles.map((article: any) => {
            const style = STATUS_STYLES[article.status] ?? STATUS_STYLES.draft;
            return (
              <Link
                key={article.id}
                href={`/articles/${article.id}`}
                style={{ textDecoration: "none" }}
              >
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
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
