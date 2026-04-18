"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  description: string;
  opening_question: string;
  prompts: string[];
}

const VALUES = [
  {
    title: "Give and Take Space",
    body: "Take the time to make your point, and actively listen when others are speaking. This creates respect for one another and for the issues at hand.",
  },
  {
    title: "Seek the Truth",
    body: "Engage with curiosity and rigor. Ground what you say in what you actually believe, and be willing to change your mind.",
  },
  {
    title: "Encourage Exploration",
    body: "Let the conversation go where it wants to go. All angles are welcome — free-flowing dialogue is the point.",
  },
];

export default function StartPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => {});
  }, []);

  const cardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: 12,
    padding: "28px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(135deg, #56a1d2 0%, #4a8bc2 100%)",
          color: "white",
          textAlign: "center",
          padding: "80px 24px 64px",
        }}
      >
        <h1 style={{ fontSize: 42, fontWeight: 700, marginBottom: 16 }}>
          Host Your Own Ai Salon
        </h1>
        <p style={{ fontSize: 20, maxWidth: 640, margin: "0 auto 32px", opacity: 0.95 }}>
          Everything you need to bring people together for a meaningful
          conversation. No sign-up required.
        </p>
        <a
          href="/start/print"
          target="_blank"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <i className="fa fa-print" aria-hidden="true" />
          Print Facilitation Guide
        </a>
      </section>

      {/* What is an AI Salon? */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <h2 className="section-title">What is an Ai Salon?</h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "#444", maxWidth: 720 }}>
          An Ai Salon is a small-group conversation where people from all
          backgrounds come together to explore a topic together. No expertise
          required — just curiosity and a willingness to listen. Our salons are
          usually about AI, but the format works for any subject that benefits
          from thoughtful, facilitated discussion.
        </p>
      </section>

      {/* How to Run One */}
      <section style={{ background: "#f8f6ec", padding: "48px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="section-title">How to Run One</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 24,
              marginTop: 32,
            }}
          >
            {[
              {
                icon: "fa-users",
                title: "1. Gather 4–12 people",
                body: "Invite friends, colleagues, or neighbors. Diverse perspectives make the best conversations.",
              },
              {
                icon: "fa-map-marker",
                title: "2. Pick a space",
                body: "A living room, coffee shop, or office works. Somewhere comfortable where people can talk freely.",
              },
              {
                icon: "fa-lightbulb-o",
                title: "3. Choose a topic",
                body: "It can be about anything. Pick something your group will find genuinely interesting. If you need inspiration, see our topics below.",
              },
              {
                icon: "fa-comments",
                title: "4. Facilitate the discussion",
                body: "Open with the framing and introductions, then ask the opening question and let the conversation flow.",
              },
            ].map((step) => (
              <div key={step.title} style={cardStyle}>
                <div style={{ marginBottom: 12 }}>
                  <i className={`fa ${step.icon}`} style={{ fontSize: 28, color: "#56a1d2" }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilitating Your Salon */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <h2 className="section-title">Facilitating Your Salon</h2>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 40, maxWidth: 720 }}>
          Once everyone&apos;s gathered, run through these three things before you
          ask the opening question.
        </p>

        {/* Step A: Open the room */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 12 }}>
            1. Introduce the conversation
          </h3>
          <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>
            Frame what you&apos;re here to do. Something like:
          </p>
          <div
            style={{
              background: "#f0f7fd",
              borderLeft: "4px solid #56a1d2",
              borderRadius: "0 8px 8px 0",
              padding: "16px 20px",
              fontStyle: "italic",
              fontSize: 16,
              color: "#333",
              lineHeight: 1.7,
            }}
          >
            &ldquo;We&apos;re here to talk together about [your topic]. There are no experts
            in this room — just curious people exploring together. Before we start,
            here are a few values that guide our conversation.&rdquo;
          </div>
        </div>

        {/* Step B: Values */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 16 }}>
            2. Share the values
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {VALUES.map((v) => (
              <div
                key={v.title}
                style={{
                  background: "white",
                  borderRadius: 8,
                  padding: "16px 20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <i className="fa fa-check-circle" style={{ color: "#56a1d2", fontSize: 18, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>{v.title}</div>
                  <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{v.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step C: Introductions */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 12 }}>
            3. Introductions
          </h3>
          <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>
            Go around the room. Ask each person to share two things:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <li style={{ fontSize: 16, color: "#555", lineHeight: 1.6 }}>Their name</li>
            <li style={{ fontSize: 16, color: "#555", lineHeight: 1.6 }}>
              What they&apos;re most interested in exploring about today&apos;s topic
            </li>
          </ul>
          <div
            style={{
              background: "#fffbf0",
              border: "1px solid #d2b356",
              borderRadius: 8,
              padding: "16px 20px",
              fontSize: 15,
              color: "#555",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "#111" }}>This moment matters.</strong> As the
            facilitator, listen carefully — the themes that come up in introductions
            will tell you what&apos;s on people&apos;s minds. It&apos;s also each
            person&apos;s first chance to contribute, and the group&apos;s first
            chance to listen to one another. Don&apos;t rush it.
          </div>
        </div>

        {/* Then: opening question */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 12 }}>
            4. Ask the opening question
          </h3>
          <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7 }}>
            Once everyone has introduced themselves, ask your opening question and
            let the conversation flow. Use your follow-up prompts to go deeper when
            the energy calls for it — don&apos;t feel obligated to use all of them.
          </p>
        </div>
      </section>

      {/* Topic Inspiration */}
      <section style={{ background: "#f8f6ec", padding: "48px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="section-title">Topic Inspiration</h2>
          <p style={{ color: "#666", marginBottom: 32, fontSize: 16, lineHeight: 1.7 }}>
            Your salon can be about anything. If you need a starting point, here
            are some of our curated topics — each comes with an opening question
            and follow-up prompts.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {topics.map((topic) => (
              <div key={topic.id} style={{ background: "white", borderRadius: 12, padding: "24px 28px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div
                  onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
                  style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>{topic.title}</h3>
                  <i
                    className={`fa ${expandedTopic === topic.id ? "fa-chevron-down" : "fa-chevron-right"}`}
                    style={{ color: "#999", fontSize: 14, flexShrink: 0, marginLeft: 12 }}
                  />
                </div>
                <p style={{ color: "#555", margin: "8px 0 0", fontSize: 15, lineHeight: 1.6 }}>
                  {topic.description}
                </p>
                {expandedTopic === topic.id && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ background: "#f0f7fd", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#56a1d2", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        Opening Question
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{topic.opening_question}</p>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      Follow-up Prompts
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                      {topic.prompts.map((p, i) => (
                        <li key={i} style={{ fontSize: 15, color: "#555", lineHeight: 1.5 }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section style={{ padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "#888", fontSize: 15, marginBottom: 8 }}>
          Want to connect with other hosts or become an official chapter?
        </p>
        <Link href="/host" style={{ color: "#56a1d2", fontWeight: 600, fontSize: 15 }}>
          Learn more about hosting →
        </Link>
      </section>
    </div>
  );
}
