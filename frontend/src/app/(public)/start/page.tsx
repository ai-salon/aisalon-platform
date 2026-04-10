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

export default function StartPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => {});
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select an audio file.");
      return;
    }
    setSubmitting(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    if (email) fd.append("email", email);
    if (selectedTopic) fd.append("topic_id", selectedTopic);
    if (notes) fd.append("notes", notes);

    try {
      const r = await fetch(`${API}/community/upload`, { method: "POST", body: fd });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.detail || `Upload failed (${r.status})`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "48px 24px",
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: 12,
    padding: "28px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 15,
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "#333",
    marginBottom: 6,
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
        <p style={{ fontSize: 20, maxWidth: 640, margin: "0 auto", opacity: 0.95 }}>
          Everything you need to bring people together for a meaningful
          conversation about AI. No sign-up required.
        </p>
      </section>

      {/* What is an AI Salon? */}
      <section style={{ ...sectionStyle }}>
        <h2 className="section-title">What is an AI Salon?</h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "#444", maxWidth: 720 }}>
          An AI Salon is a small-group conversation where people from all
          backgrounds come together to explore how artificial intelligence is
          shaping our world. No expertise required — just curiosity and a
          willingness to listen.
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
                title: "1. Gather 4-12 people",
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
                body: "Browse our curated topics below, each with an opening question and follow-up prompts.",
              },
              {
                icon: "fa-comments",
                title: "4. Facilitate the discussion",
                body: "Start with the opening question, let the conversation flow, and use prompts to go deeper.",
              },
              {
                icon: "fa-microphone",
                title: "5. Record & share",
                body: "If your group agrees, record the conversation and upload it below. We'll turn it into an insight article.",
              },
            ].map((step) => (
              <div key={step.title} style={cardStyle}>
                <div style={{ marginBottom: 12 }}>
                  <i
                    className={`fa ${step.icon}`}
                    style={{ fontSize: 28, color: "#56a1d2" }}
                  />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pick a Topic */}
      <section style={sectionStyle}>
        <h2 className="section-title">Pick a Topic</h2>
        <p style={{ color: "#666", marginBottom: 32 }}>
          Each topic comes with an opening question and follow-up prompts to keep
          the conversation flowing.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {topics.map((topic) => (
            <div key={topic.id} style={cardStyle}>
              <div
                onClick={() =>
                  setExpandedTopic(
                    expandedTopic === topic.id ? null : topic.id
                  )
                }
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
                  {topic.title}
                </h3>
                <i
                  className={`fa ${
                    expandedTopic === topic.id
                      ? "fa-chevron-down"
                      : "fa-chevron-right"
                  }`}
                  style={{ color: "#999", fontSize: 14 }}
                />
              </div>
              <p
                style={{
                  color: "#555",
                  margin: "8px 0 0",
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                {topic.description}
              </p>
              {expandedTopic === topic.id && (
                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      background: "#f0f7fd",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#56a1d2",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Opening Question
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
                      {topic.opening_question}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    Follow-up Prompts
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {topic.prompts.map((p, i) => (
                      <li
                        key={i}
                        style={{ fontSize: 15, color: "#555", lineHeight: 1.5 }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Upload Form */}
      <section style={{ background: "#f8f6ec", padding: "48px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 className="section-title">Share Your Conversation</h2>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Recorded your salon? Upload it here and we&apos;ll turn it into an
            insight article for the community.
          </p>

          {submitted ? (
            <div
              style={{
                ...cardStyle,
                textAlign: "center",
                padding: 40,
              }}
            >
              <i
                className="fa fa-check-circle"
                style={{ fontSize: 48, color: "#22c55e", marginBottom: 16 }}
              />
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>
                Thank you for sharing!
              </h3>
              <p style={{ color: "#666" }}>
                We&apos;ll review your recording and let you know when it&apos;s
                published.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleUpload}
              style={{ ...cardStyle }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email (optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Topic discussed</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select a topic (optional)</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Audio recording <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like us to know about this conversation..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                />
              </div>

              {error && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: "100%", fontSize: 16, padding: "12px 0" }}
              >
                {submitting ? "Uploading..." : "Upload Recording"}
              </button>
            </form>
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: 32,
              color: "#888",
              fontSize: 14,
            }}
          >
            Want to become an official host?{" "}
            <Link href="/host" style={{ color: "#56a1d2" }}>
              Learn more about hosting
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
