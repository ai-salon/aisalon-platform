"use client";

import { useState, useEffect } from "react";

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

const hintStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  marginBottom: 8,
  marginTop: -2,
};

type ChapterOption = { id: string; name: string; code: string };

const SPACE_OPTIONS = [
  "Yes, for small groups of 10–20",
  "Yes, for medium groups of 30–50",
  "Yes, for large groups of 50–150",
  "I'd need help brainstorming about where I could host.",
  "Other",
];

export default function HostPage() {
  const [interestType, setInterestType] = useState<"start_chapter" | "host_existing">("start_chapter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [existingChapter, setExistingChapter] = useState("");
  const [salonsAttended, setSalonsAttended] = useState("");
  const [facilitatedBefore, setFacilitatedBefore] = useState("");
  const [themesInterested, setThemesInterested] = useState("");
  const [whyHosting, setWhyHosting] = useState("");
  const [hostingFrequency, setHostingFrequency] = useState("");
  const [spaceOptions, setSpaceOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/chapters`)
      .then((r) => r.json())
      .then(setChapters)
      .catch(() => {});
  }, []);

  const toggleSpaceOption = (opt: string) => {
    setSpaceOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spaceOptions.length === 0) {
      setError("Please select at least one space option.");
      return;
    }
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
          salons_attended: salonsAttended || null,
          facilitated_before: facilitatedBefore || null,
          themes_interested: themesInterested || null,
          why_hosting: whyHosting || null,
          hosting_frequency: hostingFrequency || null,
          space_options: spaceOptions.length > 0 ? spaceOptions.join(", ") : null,
        }),
      });
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      setSubmitted(true);
      window.umami?.track('host-interest-submitted', { type: interestType });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── TWO INFO CARDS ── */}
      <section style={{ background: "#f8f6ec", padding: "48px 30px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>
              Join the Ai Salon Commons
            </h1>
            <p style={{ fontSize: 17, color: "#696969", lineHeight: 1.6, maxWidth: 600, margin: 0 }}>
              We&apos;re growing globally. Whether you want to start a new chapter
              or become a host in an existing city, we&apos;d love to hear from you.
            </p>
          </div>

          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 64 }}>
            {/* Card 1 */}
            <div style={{ flex: "1 1 380px", background: "#fff", borderRadius: 10, padding: "36px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderTop: "4px solid #56a1d2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <i className="fa fa-plus-circle" style={{ fontSize: 32, color: "#56a1d2" }} />
                <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0 }}>Start a Chapter</h3>
              </div>
              <p style={{ fontSize: 15, color: "#696969", lineHeight: 1.7, margin: 0 }}>
                Launch an Ai Salon chapter in your city. You&apos;ll work with our global team to
                organize events, build community, and join a network of chapter leads exploring
                the societal impact of AI.
              </p>
            </div>
            {/* Card 2 */}
            <div style={{ flex: "1 1 380px", background: "#fff", borderRadius: 10, padding: "36px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderTop: "4px solid #d2b356" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <i className="fa fa-users" style={{ fontSize: 32, color: "#d2b356" }} />
                <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0 }}>Host in an Existing Chapter</h3>
              </div>
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
              <div className="host-toggle-buttons" style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
                {[
                  { value: "start_chapter", label: "Start a Chapter", icon: "fa-plus-circle", event: "host-toggle-start-chapter" },
                  { value: "host_existing", label: "Host in an Existing Chapter", icon: "fa-users", event: "host-toggle-host-existing" },
                ].map(({ value, label, icon, event }) => {
                  const active = interestType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterestType(value as any)}
                      data-umami-event={event}
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
              <div className="host-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="name">Full Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="email">Email <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20, gridColumn: interestType === "host_existing" ? "1" : "1 / -1" }}>
                  <label style={labelStyle} htmlFor="city">City <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London…" style={inputStyle} />
                </div>
                {interestType === "host_existing" && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle} htmlFor="existing_chapter">Which Chapter?</label>
                    <select
                      id="existing_chapter"
                      value={existingChapter}
                      onChange={e => setExistingChapter(e.target.value)}
                      style={{ ...inputStyle, appearance: "auto" }}
                    >
                      <option value="">Select a chapter…</option>
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.name}>{ch.name}</option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Additional questions */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="salons_attended">
                  Which Ai Salons have you been to? <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(If none, that&apos;s ok!)</span>
                </label>
                <input
                  id="salons_attended"
                  type="text"
                  value={salonsAttended}
                  onChange={e => setSalonsAttended(e.target.value)}
                  placeholder="e.g. San Francisco, London, none yet…"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="facilitated_before">
                  Have you ever facilitated anything like a salon before? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={hintStyle}>Could be anything from dinner parties to book clubs to professional networking events.</p>
                <input
                  id="facilitated_before"
                  type="text"
                  required
                  value={facilitatedBefore}
                  onChange={e => setFacilitatedBefore(e.target.value)}
                  placeholder="Tell us about your experience…"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="themes_interested">
                  What themes are you interested in exploring in your Ai Salons? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="themes_interested"
                  type="text"
                  required
                  value={themesInterested}
                  onChange={e => setThemesInterested(e.target.value)}
                  placeholder="e.g. AI and democracy, future of work…"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="why_hosting">
                  Why are you interested in hosting? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={hintStyle}>Let us know what you want to get out of this!</p>
                <textarea
                  id="why_hosting"
                  required
                  value={whyHosting}
                  onChange={e => setWhyHosting(e.target.value)}
                  rows={4}
                  placeholder="Tell us your motivation…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Hosting frequency — radio */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  How often are you interested in hosting? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={hintStyle}>A commitment of once a quarter is minimum, but we hope you&apos;ll host more!</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { value: "more_than_monthly", label: "More than monthly" },
                    { value: "monthly", label: "Monthly" },
                    { value: "quarterly", label: "Quarterly" },
                  ].map(({ value, label }) => (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 400, fontSize: 15, color: "#111" }}>
                      <input
                        type="radio"
                        name="hosting_frequency"
                        value={value}
                        required
                        checked={hostingFrequency === value}
                        onChange={() => setHostingFrequency(value)}
                        style={{ accentColor: "#56a1d2", width: 18, height: 18 }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Space to host — checkboxes */}
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>
                  Do you have a space to host? <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(Check all that apply)</span> <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={hintStyle}>
                  Having a space is the most important thing to make this easy. Hosts have used their own apartments, public spaces like libraries, co-working or social areas.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {SPACE_OPTIONS.map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 400, fontSize: 15, color: "#111" }}>
                      <input
                        type="checkbox"
                        checked={spaceOptions.includes(opt)}
                        onChange={() => toggleSpaceOption(opt)}
                        style={{ accentColor: "#56a1d2", width: 18, height: 18 }}
                      />
                      {opt}
                    </label>
                  ))}
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
