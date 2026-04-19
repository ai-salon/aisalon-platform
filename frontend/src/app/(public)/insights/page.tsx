import type { Metadata } from "next";
import { fetchOgData, type OgData } from "@/lib/og";

export const metadata: Metadata = {
  title: "Insights – Ai Salon",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ArticleSummary = {
  id: string; title: string; status: string;
  substack_url: string | null;
  chapter_id: string; created_at: string;
  publish_date: string | null;
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

  const ogResults = await Promise.allSettled(
    articles.map((a) =>
      a.substack_url ? fetchOgData(a.substack_url) : Promise.resolve({ image: null, description: null })
    )
  );
  const ogMap: Record<string, OgData> = {};
  articles.forEach((a, i) => {
    const r = ogResults[i];
    ogMap[a.id] = r.status === "fulfilled" ? r.value : { image: null, description: null };
  });

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
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <i className="fa fa-newspaper-o" aria-hidden="true" style={{ fontSize: 48, color: "#d2b356", marginBottom: 20, display: "block" }} />
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                Read us on Substack
              </h3>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.6, maxWidth: 400, margin: "0 auto 24px" }}>
                Our community insights are published on Substack. Subscribe to get curated perspectives from our in-person conversations.
              </p>
              <a
                href="https://aisalon.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ display: "inline-block" }}
                data-umami-event="insights-visit-archive"
              >
                Visit The Ai Salon Archive
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {articles.map((a) => {
                const og = ogMap[a.id];
                return (
                  <a
                    key={a.id}
                    href={a.substack_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                    data-umami-event="article-card-click"
                    data-umami-event-title={a.title}
                  >
                    <article
                      style={{
                        background: "#fff",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        borderLeft: "4px solid #56a1d2",
                        overflow: "hidden",
                        display: "flex",
                        transition: "box-shadow 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, padding: "24px 28px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                          {chapterMap[a.chapter_id] && (
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#d2b356" }}>
                              {chapterMap[a.chapter_id]}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>·</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            {new Date(a.publish_date ? a.publish_date + "T00:00:00" : a.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 8px", lineHeight: 1.35 }}>
                          {a.title}
                        </h2>
                        {og.description && (
                          <p style={{
                            fontSize: 14,
                            color: "#696969",
                            lineHeight: 1.55,
                            margin: "0 0 12px",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {og.description}
                          </p>
                        )}
                        <span style={{ fontSize: 13, color: "#56a1d2", fontWeight: 600 }}>
                          Read on Substack →
                        </span>
                      </div>
                      {og.image && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={og.image}
                          alt=""
                          style={{
                            width: 160,
                            flexShrink: 0,
                            objectFit: "cover",
                            objectPosition: "center",
                          }}
                        />
                      )}
                    </article>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
