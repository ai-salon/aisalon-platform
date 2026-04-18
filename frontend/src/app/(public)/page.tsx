"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ─────────────────────────────────────────
   Helper: two-column section wrapper
───────────────────────────────────────── */
function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`section-row ${className}`}
      style={{ maxWidth: 1140, margin: "0 auto", padding: "80px 30px" }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────
   Flip Card (click-to-flip on mobile)
───────────────────────────────────────── */
function FlipCard({ title, body }: { title: string; body: string }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flip-card${flipped ? " flipped" : ""}`}
      style={{ flex: "1 1 0", minWidth: 160 }}
      role="button"
      tabIndex={0}
      aria-label={`${title} — click to ${flipped ? "hide" : "reveal"} details`}
      onClick={() => setFlipped(!flipped)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped(!flipped);
        }
      }}
    >
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <h3>{title}</h3>
        </div>
        <div className="flip-card-back">
          <p>{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Icon Block
───────────────────────────────────────── */
function IconBlock({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
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

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */
type Member = {
  id: string; name: string; role: string;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_cofounder: boolean; display_order: number;
};

export default function HomePage() {
  const [chapters, setChapters] = useState<{ id: string; name: string; code: string; tagline: string; status: string }[]>([]);
  const [team, setTeam] = useState<Member[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/chapters`)
      .then((r) => r.json())
      .then(setChapters)
      .catch(() => {});
    fetch(`${API_URL}/team`)
      .then((r) => r.json())
      .then(setTeam)
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ── HERO ── */}
      <section id="banner">
        <div className="banner-image" />
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            padding: "0 30px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ maxWidth: 480, paddingTop: 80, paddingBottom: 60 }}>
            {/* Gold rule */}
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 28 }} />

            <h1>Shaping AI through conversation and community</h1>
            <h2>AI will impact everyone – everyone should impact AI</h2>

            {/* Gold rule */}
            <div style={{ width: 40, height: 4, background: "#d2b356", margin: "28px 0 36px" }} />

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <a
                href="https://lu.ma/Ai-salon"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                JOIN AN EVENT
              </a>
              <a
                href="https://aisalon.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                EXPLORE OUR INSIGHTS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{ background: "#fff" }}>
        <Row>
          <div style={{ display: "flex", gap: 60, flexWrap: "wrap" }}>
            {/* Left: heading */}
            <div style={{ flex: "0 0 300px", minWidth: 240 }}>
              <span className="section-label">About</span>
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
            </div>

            {/* Right: icon blocks 2×2 */}
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
        </Row>
      </section>

      {/* ── VALUES ── */}
      <section id="values" style={{ background: "#f8f6ec" }}>
        <Row>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span className="section-label">Our Values</span>
            <h2 className="section-title">The Principles That Guide Our Community</h2>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FlipCard
              title="Give and Take Space"
              body="We take the time to make our point and we actively listen to others. In doing so, we foster respect for one another and for the issues at hand."
            />
            <FlipCard
              title="Seek The Truth"
              body="AI is a transformative and fast moving technology. We strive to perpetuate the truth by engaging with curiosity and rigor to ensure points are grounded in facts."
            />
            <FlipCard
              title="Encourage Exploration"
              body="AI will take us in many directions, which our conversations will reflect. We encourage the exploration of all angles via free flowing dialogue."
            />
            <FlipCard
              title="Find Strength in Community"
              body="We're not just salon participants — we're an active community. We believe in the power of coming together to support one another and have fun while doing so!"
            />
            <FlipCard
              title="Promote Positive Impact"
              body="We find ways to extend the reach of our ideas and convert them into positive projects & partnerships to promote the participatory development of AI."
            />
          </div>
        </Row>
      </section>

      {/* ── CHAPTERS ── */}
      <section id="chapters" style={{ background: "#fff" }}>
        <Row>
          <div style={{ display: "flex", gap: 60, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Left */}
            <div style={{ flex: "0 0 380px", minWidth: 240 }}>
              <h2 className="section-title">The Ai Salon around the world</h2>
              <p className="section-subtitle">
                We believe the best AI solutions emerge when insights flow freely across
                geographic and cultural boundaries. The Ai Salon has expanded beyond San
                Francisco to a global community across six cities (and growing!).
              </p>
            </div>

            {/* Right */}
            <div style={{ flex: "1 1 300px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                <Link href="/host" className="chapter-button">
                  <i className="fa fa-plus-circle" aria-hidden="true" /> Start a Chapter
                </Link>
                <Link href="/host" className="chapter-button">
                  <i className="fa fa-plus-circle" aria-hidden="true" /> Become a Host in an Existing Chapter
                </Link>
              </div>

              {chapters.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "#696969",
                      marginBottom: 12,
                    }}
                  >
                    Existing Chapters:
                  </p>
                  <div className="chapter-grid">
                    {chapters.map((ch) => (
                      <Link
                        key={ch.id}
                        href={`/chapters/${ch.code}`}
                        className="chapter-card"
                      >
                        <i className="fa fa-map-marker" aria-hidden="true" />
                        <span>{ch.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Row>
      </section>

      {/* ── EVENTS ── */}
      <section id="events" style={{ background: "#f8f6ec" }}>
        <Row>
          <div style={{ display: "flex", gap: 60, flexWrap: "wrap", marginBottom: 60 }}>
            {/* Left */}
            <div style={{ flex: "0 0 280px", minWidth: 220 }}>
              <span className="section-label">Events</span>
              <h2 className="section-title">Join The Conversations</h2>
              <p className="section-subtitle" style={{ marginBottom: 24 }}>
                Our core events are intimate salons with 10-20 people engaged in
                facilitated, single-threaded conversations. We also host larger symposia
                bringing together around 100 people to explore AI&apos;s impact together.
              </p>
              <div className="social-proof-badge">
                <i className="fa fa-calendar-check-o" aria-hidden="true" />
                <span>70+ events hosted</span>
              </div>
            </div>

            {/* Right: 2×2 icon blocks */}
            <div style={{ flex: "1 1 400px", display: "flex", flexWrap: "wrap", gap: "0 40px" }}>
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
                body={
                  <>
                    Subscribe to our Substack newsletter,{" "}
                    <a href="https://aisalon.substack.com/" target="_blank" rel="noopener noreferrer">
                      The Ai Salon Archive
                    </a>
                    , for curated insights from in-person conversations.
                  </>
                }
              />
            </div>
          </div>

          {/* Calendar */}
          <div>
            <span className="section-label">Our Calendar</span>
            <div className="calendar-container" style={{ marginTop: 16 }}>
              <iframe
                src="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light"
                width="100%"
                height="450"
                frameBorder={0}
                allowFullScreen
                aria-hidden={false}
                tabIndex={0}
              />
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <a
                href="https://lu.ma/Ai-salon"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ display: "inline-block" }}
              >
                View All Events
              </a>
            </div>
          </div>
        </Row>
      </section>

      {/* ── INSIGHTS / SUBSTACK ── */}
      <section id="insights" style={{ background: "#fff" }}>
        <Row>
          <div style={{ display: "flex", gap: 60, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Left */}
            <div style={{ flex: "0 0 280px", minWidth: 220 }}>
              <span className="section-label">From the Archive</span>
              <h2 className="section-title">Community Insights</h2>
              <p className="section-subtitle" style={{ marginBottom: 24 }}>
                Join the conversation by subscribing to our Substack, where we transform
                our in-person conversations into digital insights.
              </p>
              <div className="social-proof-badge" style={{ marginBottom: 24 }}>
                <i className="fa fa-users" aria-hidden="true" />
                <span>6,000+ subscribers</span>
              </div>
              <a
                href="https://aisalon.substack.com/subscribe"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ display: "inline-block" }}
              >
                SUBSCRIBE
              </a>
            </div>

            {/* Right: Clean Substack CTA card */}
            <div style={{ flex: "1 1 400px" }}>
              <div
                style={{
                  background: "#f8f6ec",
                  borderRadius: 12,
                  padding: "40px 36px",
                  textAlign: "center",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <i
                  className="fa fa-newspaper-o"
                  aria-hidden="true"
                  style={{ fontSize: 48, color: "#d2b356", marginBottom: 20, display: "block" }}
                />
                <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                  The Ai Salon Archive
                </h3>
                <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.6, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
                  Curated insights from our in-person conversations, delivered to your inbox.
                </p>
                <a
                  href="https://aisalon.substack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ display: "inline-block" }}
                >
                  Read on Substack
                </a>
              </div>
            </div>
          </div>
        </Row>
      </section>

      {/* ── TEAM ── */}
      {team.length > 0 && (
        <section id="team" style={{ background: "#f8f6ec" }}>
          <Row>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="section-label">The Team</span>
              <h2 className="section-title">The People Behind the Ai Salon</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24 }}>
              {team.map((m) => (
                <div key={m.id} className="team-member-card">
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      background: "#fff",
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
          </Row>
        </section>
      )}

    </>
  );
}
