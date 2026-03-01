"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1.5px solid #e1e1e1",
  borderRadius: 6,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#696969",
  marginBottom: 6,
};

type Chapter = { id: string; name: string; code: string; tagline: string };

export default function HostChapterPage() {
  const params = useParams<{ code: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/chapters/${params.code}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setChapter)
      .catch(() => {});
  }, [params.code]);

  const chapterName = chapter?.name ?? params.code;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/hosting-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, city,
          interest_type: "host_existing",
          existing_chapter: chapterName,
          message: message || null,
        }),
      });
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── HERO ── */}
      <section id="banner" style={{ minHeight: "calc(40vh - 71px)" }}>
        <div className="banner-image" />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 30px", position: "relative", zIndex: 2 }}>
          <div style={{ paddingTop: 64, paddingBottom: 48 }}>
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 24 }} />
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#56a1d2", marginBottom: 12 }}>
              Ai Salon · {chapterName}
            </div>
            <h1 style={{ fontSize: 42, fontWeight: 800, color: "#111", margin: "0 0 16px", lineHeight: 1.15 }}>
              Become a Host
            </h1>
            <p style={{ fontSize: 18, color: "#696969", lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
              Help grow the {chapterName} Ai Salon by becoming a host.
              Hosts co-organize events, facilitate conversations, and help build the local community.
            </p>
          </div>
        </div>
      </section>

      {/* ── FORM ── */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {submitted ? (
            <div style={{ background: "#fff", borderRadius: 10, padding: "56px 40px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <i className="fa fa-check-circle" style={{ fontSize: 52, color: "#16a34a", marginBottom: 20, display: "block" }} />
              <h3 style={{ fontSize: 26, fontWeight: 700, color: "#111", marginBottom: 10 }}>Thank you!</h3>
              <p style={{ fontSize: 16, color: "#696969", marginBottom: 24 }}>
                We&apos;ll be in touch soon about hosting with the {chapterName} chapter.
              </p>
              <Link
                href={`/chapters/${params.code}`}
                style={{ fontSize: 14, color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}
              >
                ← Back to {chapterName}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ background: "#fff", borderRadius: 10, padding: "44px 48px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 8 }}>
                Host in {chapterName}
              </h2>
              <p style={{ fontSize: 15, color: "#696969", marginBottom: 32 }}>
                Fill out the form below and a member of our team will reach out.
              </p>

              <div className="host-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="name">Full Name</label>
                  <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="email">Email</label>
                  <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20, gridColumn: "1 / -1" }}>
                  <label style={labelStyle} htmlFor="city">City</label>
                  <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London…" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 28, gridColumn: "1 / -1" }}>
                  <label style={labelStyle} htmlFor="message">Anything else? <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                  <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Tell us about yourself or your interest…" style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              </div>

              {error && <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 16 }}>{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ width: "100%", textAlign: "center", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "block" }}
              >
                {submitting ? "Submitting…" : "Send My Interest"}
              </button>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                <Link
                  href={`/chapters/${params.code}`}
                  style={{ fontSize: 14, color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}
                >
                  ← Back to {chapterName}
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
