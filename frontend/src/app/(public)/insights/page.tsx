import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ArticleSummary = {
  id: string; title: string; status: string;
  chapter_id: string; created_at: string;
};

async function getArticles(): Promise<ArticleSummary[]> {
  const r = await fetch(`${API_URL}/articles`, { cache: "no-store" });
  if (!r.ok) return [];
  return r.json();
}

async function getChapters() {
  const r = await fetch(`${API_URL}/chapters`, { cache: "no-store" });
  if (!r.ok) return [];
  return r.json();
}

export default async function InsightsPage() {
  const [articles, chapters] = await Promise.all([getArticles(), getChapters()]);
  const chapterMap: Record<string, string> = {};
  for (const c of chapters) chapterMap[c.id] = c.name;

  return (
    <div>
      {/* Hero */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px 56px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h1
            style={{ fontSize: 42, fontWeight: 800, color: "#111", margin: "0 0 14px" }}
            className="section-title"
          >
            Insights
          </h1>
          <p style={{ fontSize: 17, color: "#696969", lineHeight: 1.65, margin: 0, maxWidth: 600 }}>
            Conversations, ideas, and perspectives from the Ai Salon community.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section style={{ padding: "56px 30px 80px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {articles.length === 0 ? (
            <div style={{ textAlign: "center", color: "#696969", padding: "60px 0" }}>
              <i className="fa fa-file-text-o" style={{ fontSize: 36, color: "#d1d5db", marginBottom: 14, display: "block" }} />
              <p style={{ fontSize: 15 }}>No articles published yet. Check back soon.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {articles.map((a) => (
                <Link key={a.id} href={`/insights/${a.id}`} style={{ textDecoration: "none" }}>
                  <article
                    style={{
                      background: "#fff",
                      borderRadius: 8,
                      padding: "24px 28px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      borderLeft: "4px solid #56a1d2",
                      transition: "box-shadow 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      {chapterMap[a.chapter_id] && (
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#d2b356" }}>
                          {chapterMap[a.chapter_id]}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>·</span>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        {new Date(a.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 8px", lineHeight: 1.35 }}>
                      {a.title}
                    </h2>
                    <span style={{ fontSize: 13, color: "#56a1d2", fontWeight: 600 }}>
                      Read article →
                    </span>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
