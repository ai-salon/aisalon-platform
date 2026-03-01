"use client";

import { useState } from "react";

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
          name, email, city,
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

  return (
    <div>
      {/* ── HERO — matches main page style ── */}
      <section id="banner" style={{ minHeight: "calc(50vh - 71px)" }}>
        <div className="banner-image" />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 30px", position: "relative", zIndex: 2 }}>
          <div style={{ maxWidth: 600, paddingTop: 72, paddingBottom: 60 }}>
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 24 }} />
            <h1 style={{ fontSize: 48, fontWeight: 800, color: "#111", margin: "0 0 16px", lineHeight: 1.15 }}>
              Bring the Ai Salon<br />to Your City
            </h1>
            <p style={{ fontSize: 20, color: "#696969", lineHeight: 1.6, margin: "0 0 32px", maxWidth: 520 }}>
              We&apos;re growing globally. Whether you want to start a new chapter
              or become a host in an existing city, we&apos;d love to hear from you.
            </p>
            <div style={{ width: 40, height: 4, background: "#d2b356" }} />
          </div>
        </div>
      </section>

      {/* ── TWO INFO CARDS ── */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span className="section-label">Get Involved</span>
            <h2 className="section-title" style={{ display: "inline-block" }}>
              Join the Ai Salon Network
            </h2>
          </div>

          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 64 }}>
            {/* Card 1 */}
            <div style={{ flex: "1 1 380px", background: "#fff", borderRadius: 10, padding: "36px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderTop: "4px solid #56a1d2" }}>
              <i className="fa fa-plus-circle" style={{ fontSize: 32, color: "#56a1d2", marginBottom: 16, display: "block" }} />
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 12 }}>Start a Chapter</h3>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.7, margin: 0 }}>
                Launch an Ai Salon chapter in your city. You&apos;ll work with our global team to
                organize events, build community, and join a network of chapter leads exploring
                the societal impact of AI.
              </p>
            </div>
            {/* Card 2 */}
            <div style={{ flex: "1 1 380px", background: "#fff", borderRadius: 10, padding: "36px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderTop: "4px solid #d2b356" }}>
              <i className="fa fa-users" style={{ fontSize: 32, color: "#d2b356", marginBottom: 16, display: "block" }} />
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 12 }}>Host in an Existing Chapter</h3>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.7, margin: 0 }}>
                Already in a city with an Ai Salon chapter? Become a host and help expand our
                reach. Hosts co-organize events, facilitate conversations, and help grow the
                local community.
              </p>
            </div>
          </div>

          {/* ── FORM ── */}
          {submitted ? (
            <div style={{ background: "#fff", borderRadius: 10, padding: "56px 40px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", maxWidth: 520, margin: "0 auto" }}>
              <i className="fa fa-check-circle" style={{ fontSize: 52, color: "#16a34a", marginBottom: 20, display: "block" }} />
              <h3 style={{ fontSize: 26, fontWeight: 700, color: "#111", marginBottom: 10 }}>Thank you!</h3>
              <p style={{ fontSize: 16, color: "#696969" }}>We&apos;ll be in touch soon.</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ background: "#fff", borderRadius: 10, padding: "44px 48px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", maxWidth: 680, margin: "0 auto" }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 8 }}>Express Interest</h2>
              <p style={{ fontSize: 15, color: "#696969", marginBottom: 32 }}>
                Fill out the form below and a member of our team will reach out.
              </p>

              {/* Interest type toggle */}
              <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
                {[
                  { value: "start_chapter", label: "Start a Chapter", icon: "fa-plus-circle" },
                  { value: "host_existing", label: "Host in an Existing Chapter", icon: "fa-users" },
                ].map(({ value, label, icon }) => {
                  const active = interestType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterestType(value as any)}
                      style={{
                        flex: "1 1 200px",
                        padding: "14px 20px",
                        borderRadius: 8,
                        border: `2px solid ${active ? "#56a1d2" : "#e1e1e1"}`,
                        background: active ? "#eff6ff" : "#fff",
                        color: active ? "#1d4ed8" : "#696969",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                    >
                      <i className={`fa ${icon}`} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Fields — two columns on desktop */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="name">Full Name</label>
                  <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="email">Email</label>
                  <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20, gridColumn: interestType === "host_existing" ? "1" : "1 / -1" }}>
                  <label style={labelStyle} htmlFor="city">City</label>
                  <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London…" style={inputStyle} />
                </div>
                {interestType === "host_existing" && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle} htmlFor="existing_chapter">Which Chapter?</label>
                    <input id="existing_chapter" type="text" value={existingChapter} onChange={e => setExistingChapter(e.target.value)} placeholder="e.g. Berlin, NYC…" style={inputStyle} />
                  </div>
                )}
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
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
