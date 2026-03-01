import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Member = {
  id: string; name: string; role: string;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_cofounder: boolean;
};

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string; team_members: Member[];
};

async function getChapter(code: string): Promise<Chapter | null> {
  const r = await fetch(`${API_URL}/chapters/${code}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch chapter");
  return r.json();
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

  const cofounders = chapter.team_members.filter((m) => m.is_cofounder);
  const others = chapter.team_members.filter((m) => !m.is_cofounder);
  const sortedMembers = [...cofounders, ...others];

  return (
    <div>
      {/* ── HERO ── */}
      <section id="banner" style={{ minHeight: "calc(60vh - 71px)" }}>
        <div className="banner-image" />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 30px", position: "relative", zIndex: 2 }}>
          <div style={{ maxWidth: 560, paddingTop: 72, paddingBottom: 60 }}>
            {/* Gold rule */}
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 24 }} />
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#56a1d2", marginBottom: 12 }}>
              Ai Salon · {chapter.name}
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15, color: "#111" }}>
              {chapter.title}
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.6, margin: "0 0 32px", color: "#696969" }}>
              {chapter.tagline}
            </p>
            {/* Gold rule */}
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 32 }} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
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
            <Link href="/insights" className="btn btn-outline">
              EXPLORE INSIGHTS
            </Link>
          </div>
        </div>
        </div>
      </section>

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
              body="We bring together scientists, technologists, policymakers, academia, artists and the generally curious to consider and shape our future together."
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

      {/* ── EVENTS ── */}
      <section style={{ background: "#fff", padding: "72px 30px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 60, flexWrap: "wrap", marginBottom: 56 }}>
            {/* Left */}
            <div style={{ flex: "0 0 300px", minWidth: 240 }}>
              <span className="section-label">Events</span>
              <h2 className="section-title">Join the Conversation</h2>
              {chapter.events_description && (
                <p className="section-subtitle" style={{ marginBottom: 20 }}>
                  {chapter.events_description}
                </p>
              )}
              <div className="social-proof-badge">
                <i className="fa fa-calendar-check-o" aria-hidden="true" />
                <span>70+ events hosted</span>
              </div>
            </div>

            {/* Right */}
            <div style={{ flex: "1 1 380px", display: "flex", flexWrap: "wrap", gap: "0 40px" }}>
              <IconBlock
                icon="fa-comments-o"
                title="Intimate Salons"
                body="Join our signature 10-20 person facilitated, single-threaded conversations that explore various themes in AI."
              />
              <IconBlock
                icon="fa-users"
                title="Large Symposia"
                body="Experience our larger events, which bring together 100+ people around a broader topic before we break into more specific, intimate discussion groups."
              />
              <IconBlock
                icon="fa-calendar"
                title="Regular Schedule"
                body="We've hosted 70+ events bringing over 1000 people together to discuss AI's impact across various domains."
              />
              <IconBlock
                icon="fa-newspaper-o"
                title="Digital Dialogue"
                body="Subscribe to our Substack newsletter for curated insights from in-person conversations."
              />
            </div>
          </div>

          {/* Calendar */}
          {chapter.calendar_embed && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 16 }}>
                {chapter.name} Calendar
              </h3>
              <div className="event-legend">
                <span className="event-type-badge salon">
                  <i className="fa fa-circle" style={{ fontSize: 8 }} aria-hidden="true" /> Salon
                </span>
                <span className="event-type-badge symposium">
                  <i className="fa fa-circle" style={{ fontSize: 8 }} aria-hidden="true" /> Symposium
                </span>
                <span className="event-type-badge expert">
                  <i className="fa fa-circle" style={{ fontSize: 8 }} aria-hidden="true" /> Expert Talk
                </span>
              </div>
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
          )}
        </div>
      </section>

      {/* ── TEAM ── */}
      {sortedMembers.length > 0 && (
        <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 className="section-title" style={{ marginBottom: 48 }}>
              The People Behind the {chapter.name} Ai Salon
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24 }}>
              {sortedMembers.map((m) => (
                <div key={m.id} className="team-member-card">
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      background: "#f8f6ec",
                      margin: "0 auto 16px",
                      overflow: "hidden",
                      border: "3px solid #d2b356",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {m.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.profile_image_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <i className="fa fa-user" style={{ fontSize: 36, color: "#d2b356" }} aria-hidden="true" />
                    )}
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{m.name}</h4>
                  <p style={{ fontSize: 13, color: "#56a1d2", fontWeight: 600, margin: "0 0 8px" }}>{m.role}</p>
                  {m.is_cofounder && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", color: "#56a1d2", display: "inline-block", marginBottom: 8 }}>
                      Co-founder
                    </span>
                  )}
                  {m.description && (
                    <p style={{ fontSize: 13, color: "#696969", lineHeight: 1.5, margin: "0 0 8px" }}>{m.description}</p>
                  )}
                  {m.linkedin && (
                    <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label={`${m.name} on LinkedIn`} style={{ color: "#696969", fontSize: 18 }}>
                      <i className="fa fa-linkedin-square" aria-hidden="true" />
                    </a>
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
