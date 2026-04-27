import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchOgData, type OgData } from "@/lib/og";
import { getPublicFlags } from "@/lib/featureFlags";
import { InteractiveLogo } from "@/components/InteractiveLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Member = {
  id: string; name: string; title: string | null;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_founder: boolean;
  chapter_code: string | null; chapter_name: string | null;
};

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string;
};

type ArticleSummary = {
  id: string; title: string; substack_url: string | null;
  chapter_id: string; created_at: string; publish_date: string | null;
};

async function getChapter(code: string): Promise<Chapter | null> {
  try {
    const r = await fetch(`${API_URL}/chapters/${code}`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function getChapterArticles(chapterId: string): Promise<ArticleSummary[]> {
  try {
    const r = await fetch(`${API_URL}/articles?chapter_id=${chapterId}`, { cache: "no-store" });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

function formatDate(a: ArticleSummary): string {
  const raw = a.publish_date ? a.publish_date + "T00:00:00" : a.created_at;
  return new Date(raw).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const chapter = await getChapter(code);
  if (!chapter) return { title: "Chapter – Ai Salon" };
  return { title: `${chapter.name} – Ai Salon` };
}

function IconBlock({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="icon-block" style={{ flex: "1 1 calc(50% - 20px)", minWidth: 220, marginBottom: 40 }}>
      <div className="icon">
        <i className={`fa ${icon}`} aria-hidden="true" />
      </div>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

export default async function ChapterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const chapter = await getChapter(code);
  if (!chapter) notFound();

  const flags = await getPublicFlags();
  const articles = await getChapterArticles(chapter.id);
  const ogResults = await Promise.allSettled(
    articles.map((a) => a.substack_url ? fetchOgData(a.substack_url) : Promise.resolve({ image: null, description: null }))
  );
  const ogMap: Record<string, OgData> = {};
  articles.forEach((a, i) => {
    const r = ogResults[i];
    ogMap[a.id] = r.status === "fulfilled" ? r.value : { image: null, description: null };
  });

  async function getChapterTeam(code: string): Promise<Member[]> {
    try {
      const r = await fetch(`${API_URL}/team`, { cache: "no-store" });
      if (!r.ok) return [];
      const all: Member[] = await r.json();
      return all.filter((m) => m.chapter_code === code);
    } catch {
      return [];
    }
  }
  const sortedMembers = await getChapterTeam(chapter.code);

  return (
    <div>
      {/* ── HERO ── */}
      <section id="banner">
        <div className="banner-interactive">
          <InteractiveLogo />
        </div>
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            padding: "0 30px",
            position: "relative",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 480, paddingTop: 80, paddingBottom: 60, pointerEvents: "auto" }}>
            {/* Gold rule */}
            <div className="banner-text-rule" style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 28 }} />
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#56a1d2", marginBottom: 12 }}>
              <span>Ai Salon</span>
              <span style={{ textTransform: "uppercase" }}> · {chapter.name}</span>
            </div>
            <h1>{chapter.title}</h1>
            <h2>{chapter.tagline}</h2>
            {/* Gold rule */}
            <div className="banner-text-rule" style={{ width: 40, height: 4, background: "#d2b356", margin: "28px 0 36px" }} />
            <div className="hero-ctas" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {chapter.event_link && (
                <a
                  href={chapter.event_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  JOIN EVENTS
                </a>
              )}
              <Link href={`/host/${chapter.code}`} className="btn btn-outline">
                BECOME A HOST
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── UPCOMING EVENTS ── */}
      {chapter.calendar_embed && (
        <section style={{ background: "#fff", padding: "72px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <span className="section-label">Events</span>
            <h2 className="section-title">Upcoming Events</h2>
            {chapter.events_description && (
              <p className="section-subtitle" style={{ marginBottom: 24 }}>
                {chapter.events_description}
              </p>
            )}
            <div className="calendar-container">
              <iframe
                src={chapter.calendar_embed}
                width="100%"
                height="450"
                style={{ border: "none", display: "block" }}
                title={`${chapter.name} events calendar`}
              />
            </div>
            {chapter.event_link && (
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <a
                  href={chapter.event_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ display: "inline-block" }}
                >
                  View All {chapter.name} Events
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 60, flexWrap: "wrap" }}>
          {/* Left */}
          <div style={{ flex: "0 0 360px", minWidth: 240 }}>
            {chapter.about ? (
              <>
                <h2 className="section-title">
                  About the {chapter.name} Chapter
                </h2>
                <p className="section-subtitle">
                  {chapter.about}
                </p>
                <div style={{ marginTop: 28, padding: "20px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: "#696969" }}>
                    The Ai Salon is a global community founded in San Francisco to create
                    conversation and community around the meaning and impact of artificial
                    intelligence.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="section-title">
                  Creating conversation around the impact of AI
                </h2>
                <p className="section-subtitle">
                  The Ai Salon is a global community founded in San Francisco to create
                  conversation and community around the meaning and impact of artificial
                  intelligence. We believe that consideration and input from a vibrant
                  civil society is critical to successfully navigating this transformative
                  moment in human history.
                </p>
              </>
            )}
          </div>

          {/* Right: 2×2 icon blocks */}
          <div style={{ flex: "1 1 400px", display: "flex", flexWrap: "wrap", gap: "0 40px" }}>
            <IconBlock
              icon="fa-users"
              title="Vibrant Community"
              body="We bring together scientists, technologists, policymakers, academics, artists and the generally curious to consider and shape our future together."
            />
            <IconBlock
              icon="fa-comments"
              title="Meaningful Dialogue"
              body="Our salons foster intimate, single-threaded conversations that explore the depths of AI's impact, across a range of domains."
            />
            <IconBlock
              icon="fa-globe"
              title="Global Reach"
              body="With chapters across six cities (and growing!), we're breaking down geographic barriers to ensure valuable perspectives from all regions contribute to AI's development."
            />
            <IconBlock
              icon="fa-lightbulb-o"
              title="Participatory AI Development"
              body="We believe AI should be shaped by those it affects. Through participatory alignment and community-driven governance, we work to ensure diverse perspectives influence AI systems."
            />
          </div>
        </div>
      </section>

      {/* ── INSIGHTS ── */}
      {articles.length > 0 && (
        <section style={{ background: "#fff", padding: "72px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <span className="section-label">From the Archive</span>
            <h2 className="section-title">{chapter.name} Insights</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 32 }}>
              {articles.map((a) => {
                const og = ogMap[a.id];
                return (
                  <a
                    key={a.id}
                    href={a.substack_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                    data-umami-event="chapter-article-click"
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
                      }}
                    >
                      <div style={{ flex: 1, padding: "20px 24px" }}>
                        <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 8 }}>
                          {formatDate(a)}
                        </span>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 8px", lineHeight: 1.35 }}>
                          {a.title}
                        </h3>
                        {og.description && (
                          <p style={{
                            fontSize: 13, color: "#696969", lineHeight: 1.55, margin: "0 0 10px",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          }}>
                            {og.description}
                          </p>
                        )}
                        <span style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600 }}>Read on Substack →</span>
                      </div>
                      {og.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={og.image} alt="" style={{ width: 130, flexShrink: 0, objectFit: "cover" }} />
                      )}
                    </article>
                  </a>
                );
              })}
            </div>
            {flags.insights_enabled && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <Link href="/insights" style={{ fontSize: 14, color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}>
                  View all community insights →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TEAM ── */}
      {sortedMembers.length > 0 && (
        <section style={{ background: "#f8f6ec", padding: "80px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#111", textAlign: "center", margin: "0 0 56px" }}>
              Leadership
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 48 }}>
              {sortedMembers.map((m) => (
                <div key={m.id} style={{ textAlign: "center" }}>
                  {/* Photo */}
                  <div
                    style={{
                      width: 195,
                      height: 195,
                      borderRadius: "50%",
                      background: "#f0ebe0",
                      margin: "0 auto 20px",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {m.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.profile_image_url.startsWith("/uploads/") ? `${API_URL}${m.profile_image_url}` : m.profile_image_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <i className="fa fa-user" style={{ fontSize: 64, color: "#d2b356" }} aria-hidden="true" />
                    )}
                  </div>
                  {/* Name + LinkedIn */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>{m.name}</h4>
                    {m.linkedin && (
                      <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label={`${m.name} on LinkedIn`} style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1 }}>
                        <i className="fa fa-linkedin-square" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  {/* Role */}
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#d2b356", margin: "0 0 10px" }}>
                    {m.title}
                  </p>
                  {/* Description */}
                  {m.description && (
                    <p style={{ fontSize: 13, color: "#555", lineHeight: 1.65, margin: 0 }}>{m.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back link */}
      <div style={{ background: "#fff", padding: "32px 30px", textAlign: "center" }}>
        <Link href="/#chapters" style={{ fontSize: 14, color: "#56a1d2", textDecoration: "none", fontWeight: 600 }}>
          ← Back to all chapters
        </Link>
      </div>
    </div>
  );
}
