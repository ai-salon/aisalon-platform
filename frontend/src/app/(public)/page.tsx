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
      className={className}
      style={{ maxWidth: 1140, margin: "0 auto", padding: "80px 30px" }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────
   Flip Card
───────────────────────────────────────── */
function FlipCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flip-card" style={{ flex: "1 1 0", minWidth: 160 }}>
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
        <i className={`fa ${icon}`} />
      </div>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */
export default function HomePage() {
  const [chapters, setChapters] = useState<{ id: string; name: string; code: string; tagline: string; status: string }[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/chapters`)
      .then((r) => r.json())
      .then(setChapters)
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
              <Link
                href="/insights"
                className="btn btn-outline"
              >
                EXPLORE OUR INSIGHTS
              </Link>
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
                <a href="/host" className="chapter-button">
                  <i className="fa fa-plus-circle" /> Start a Chapter
                </a>
                <a href="/host" className="chapter-button">
                  <i className="fa fa-plus-circle" /> Become a Host in an Existing Chapter
                </a>
              </div>

              <div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#696969",
                    marginBottom: 8,
                  }}
                >
                  Existing Chapters:
                </p>
                <p style={{ fontSize: 15, color: "#111", lineHeight: 1.8 }}>
                  {chapters.map((ch, i) => (
                    <span key={ch.id}>
                      <Link
                        href={`/chapters/${ch.code}`}
                        style={{ fontWeight: 600, color: "#56a1d2", textDecoration: "none" }}
                      >
                        {ch.name}
                      </Link>
                      {i < chapters.length - 1 && <span style={{ color: "#999", margin: "0 6px" }}>|</span>}
                    </span>
                  ))}
                </p>
              </div>
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
                <i className="fa fa-calendar-check-o" />
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

      {/* ── INSIGHTS ── */}
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
                <i className="fa fa-users" />
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

            {/* Right: Substack embed */}
            <div style={{ flex: "1 1 400px" }}>
              <iframe
                src="https://aisalon.substack.com/embed"
                width="100%"
                height="320"
                style={{
                  border: "1px solid #e1e1e1",
                  borderRadius: 8,
                  background: "white",
                }}
                frameBorder={0}
                scrolling="no"
              />
              <p style={{ marginTop: 16, fontSize: 14, color: "#696969" }}>
                Or visit{" "}
                <a href="https://aisalon.substack.com" target="_blank" rel="noopener noreferrer">
                  The Ai Salon Archive
                </a>{" "}
                to read our latest insights.
              </p>
            </div>
          </div>
        </Row>
      </section>

    </>
  );
}
