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
  { title: "Give and Take Space", body: "Listen as much as you speak." },
  { title: "Seek the Truth", body: "Say what you believe; be willing to change your mind." },
  { title: "Encourage Exploration", body: "Let the conversation go where it wants to go." },
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

  const handlePrint = () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    iframe.src = "/start/print";
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 60000);
    };
  };

  return (
    <div>
      {/* Page header */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10, color: "#111" }}>
              Host Your Own Ai Salon
            </h1>
            <p style={{ fontSize: 17, color: "#555", maxWidth: 580, lineHeight: 1.6, margin: 0 }}>
              A small-group conversation where curious people explore a topic together. No expertise required.
            </p>
          </div>
          <button
            onClick={handlePrint}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#56a1d2", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <i className="fa fa-print" aria-hidden="true" />
            Print Facilitation Guide
          </button>
        </div>
      </section>

      {/* How to Run One */}
      <section style={{ background: "#f8f6ec", padding: "40px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="section-title">How to Run One</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
              marginTop: 24,
            }}
          >
            {[
              { icon: "fa-users", title: "Gather 4–12 people", body: "Friends, colleagues, or neighbors — diverse perspectives make the best conversations." },
              { icon: "fa-map-marker", title: "Pick a space", body: "A living room, coffee shop, or office. Somewhere comfortable where people can talk freely." },
              { icon: "fa-lightbulb-o", title: "Choose a topic", body: "It can be about anything. Browse our topic ideas below for inspiration." },
              { icon: "fa-comments", title: "Facilitate", body: "Open with the framing and values, run introductions, then ask the opening question." },
            ].map((step) => (
              <div key={step.title} style={{ background: "white", borderRadius: 10, padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                <i className={`fa ${step.icon}`} style={{ fontSize: 24, color: "#56a1d2", marginBottom: 10, display: "block" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilitate the Conversation */}
      <section style={{ padding: "40px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="section-title">Facilitate the Conversation</h2>
          <p style={{ fontSize: 15, color: "#666", marginBottom: 24 }}>
            Once everyone&apos;s gathered, run through these four things in order.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>1. Introduce</div>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 8px" }}>Frame the gathering:</p>
              <p style={{ fontSize: 14, fontStyle: "italic", color: "#333", lineHeight: 1.6, borderLeft: "3px solid #56a1d2", paddingLeft: 10, margin: 0 }}>
                &ldquo;We&apos;re here to talk about [topic]. No experts — just curious people. Here are a few values...&rdquo;
              </p>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>2. Share Values</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {VALUES.map((v) => (
                  <div key={v.title} style={{ fontSize: 14, color: "#333", lineHeight: 1.5 }}>
                    <strong>{v.title}</strong> — {v.body}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>3. Introductions</div>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 10px" }}>
                Go around: each person shares their name and what they want to explore today.
              </p>
              <p style={{ fontSize: 13, color: "#7a5c00", background: "#fffbf0", border: "1px solid #d2b356", borderRadius: 4, padding: "8px 10px", margin: 0, lineHeight: 1.5 }}>
                <strong>Go first and model what you want to see.</strong> Take a moment to genuinely describe what you&apos;re curious about — it gives others permission to do the same. What comes up tells you what&apos;s on people&apos;s minds.
              </p>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>4. Opening Question</div>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: 0 }}>
                Ask it and let the conversation flow. Use follow-up prompts to go deeper when the energy calls for it — don&apos;t feel obligated to use all of them.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Topic Inspiration */}
      {topics.length > 0 && (
        <section style={{ background: "#f8f6ec", padding: "40px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 className="section-title">Topic Inspiration</h2>
            <p style={{ color: "#666", marginBottom: 24, fontSize: 15 }}>
              Your salon can be about anything. Here are some of our curated topics to get you started.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topics.map((topic) => (
                <div key={topic.id} style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                  <div
                    onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
                    style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{topic.title}</h3>
                    <i
                      className={`fa ${expandedTopic === topic.id ? "fa-chevron-down" : "fa-chevron-right"}`}
                      style={{ color: "#999", fontSize: 14, marginLeft: 12 }}
                    />
                  </div>
                  <p style={{ color: "#555", margin: "6px 0 0", fontSize: 14, lineHeight: 1.6 }}>{topic.description}</p>
                  {expandedTopic === topic.id && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ background: "#f0f7fd", borderRadius: 6, padding: "12px 16px", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#56a1d2", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          Opening Question
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{topic.opening_question}</p>
                      </div>
                      {topic.prompts.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                            Follow-up Prompts
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                            {topic.prompts.map((p, i) => (
                              <li key={i} style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>{p}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section style={{ padding: "40px 24px", textAlign: "center" }}>
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
