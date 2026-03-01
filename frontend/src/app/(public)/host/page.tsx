"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function HostPage() {
  const [interestType, setInterestType] = useState<"start_chapter" | "host_existing">("start_chapter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [existingChapter, setExistingChapter] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/hosting-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          city,
          interest_type: interestType,
          existing_chapter: interestType === "host_existing" ? existingChapter : null,
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #e1e1e1",
    borderRadius: 6,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    fontSize: 14,
    color: "#111",
    marginBottom: 6,
  };

  return (
    <div>
      {/* Hero */}
      <section style={{ background: "#56a1d2", color: "#fff", padding: "72px 30px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15 }}>
            Bring the Ai Salon to Your City
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.65, opacity: 0.92, maxWidth: 580, margin: "0 auto" }}>
            We&apos;re growing globally. Whether you want to start a new chapter or become a
            host in an existing city, we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Two info cards */}
      <section style={{ background: "#f8f6ec", padding: "64px 30px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 56 }}>
            <div style={{ flex: "1 1 360px", background: "#fff", borderRadius: 10, padding: "32px 28px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <i className="fa fa-plus-circle" style={{ fontSize: 28, color: "#56a1d2", marginBottom: 14, display: "block" }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 10 }}>Start a Chapter</h3>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.65 }}>
                Launch an Ai Salon chapter in your city. You&apos;ll work with our global team to
                organize events, build community, and join a network of chapter leads exploring
                the societal impact of AI.
              </p>
            </div>
            <div style={{ flex: "1 1 360px", background: "#fff", borderRadius: 10, padding: "32px 28px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <i className="fa fa-users" style={{ fontSize: 28, color: "#d2b356", marginBottom: 14, display: "block" }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 10 }}>Host in an Existing Chapter</h3>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.65 }}>
                Already in a city with an Ai Salon chapter? Become a host and help expand our
                reach. Hosts co-organize events, facilitate conversations, and help grow the
                local community.
              </p>
            </div>
          </div>

          {/* Form */}
          {submitted ? (
            <div style={{ background: "#fff", borderRadius: 10, padding: "48px 40px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", maxWidth: 560, margin: "0 auto" }}>
              <i className="fa fa-check-circle" style={{ fontSize: 48, color: "#16a34a", marginBottom: 16, display: "block" }} />
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 10 }}>Thank you!</h3>
              <p style={{ fontSize: 16, color: "#696969" }}>We&apos;ll be in touch soon.</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ background: "#fff", borderRadius: 10, padding: "40px 40px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", maxWidth: 640, margin: "0 auto" }}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 28 }}>Get Involved</h2>

              {/* Interest type */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>I want to…</label>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { value: "start_chapter", label: "Start a Chapter" },
                    { value: "host_existing", label: "Host in an Existing Chapter" },
                  ].map(({ value, label }) => (
                    <label
                      key={value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 15,
                        fontWeight: interestType === value ? 600 : 400,
                        color: "#111",
                      }}
                    >
                      <input
                        type="radio"
                        name="interest_type"
                        value={value}
                        checked={interestType === value}
                        onChange={() => setInterestType(value as any)}
                        style={{ accentColor: "#56a1d2" }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>

              {/* City */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="San Francisco, London, …"
                  style={inputStyle}
                />
              </div>

              {/* Existing chapter (conditional) */}
              {interestType === "host_existing" && (
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="existing_chapter">Which chapter?</label>
                  <input
                    id="existing_chapter"
                    type="text"
                    value={existingChapter}
                    onChange={(e) => setExistingChapter(e.target.value)}
                    placeholder="e.g. San Francisco, London…"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Message */}
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle} htmlFor="message">Anything else? (optional)</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us about yourself or your interest…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {error && (
                <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 16 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ width: "100%", textAlign: "center", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
