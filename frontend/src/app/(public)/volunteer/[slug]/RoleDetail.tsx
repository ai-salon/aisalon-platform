"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ABOUT_AI_SALON = `The Ai Salon is a global community of curious, thoughtful people gathered around one question: what does AI mean for humanity? Founded in San Francisco, we host small, intimate discussion groups in cities around the world — bringing together engineers, ethicists, artists, policymakers, and everyday citizens to explore AI's sociological, economic, cultural, and philosophical implications. We believe these conversations are too important to leave to technologists alone. The Salon is powered entirely by volunteers who share our commitment to rigorous, human-centered inquiry.`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  border: "1.5px solid #e1e1e1",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#696969",
  marginBottom: 5,
};

type Role = {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  time_commitment: string | null;
  chapter_id: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
};

export default function RoleDetail({ role }: { role: Role }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [whyInterested, setWhyInterested] = useState("");
  const [relevantExperience, setRelevantExperience] = useState("");
  const [availability, setAvailability] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/volunteer-roles/${role.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          city,
          linkedin_url: linkedinUrl || null,
          resume_url: resumeUrl || null,
          website_url: websiteUrl || null,
          why_interested: whyInterested,
          relevant_experience: relevantExperience,
          availability,
          how_heard: howHeard || null,
        }),
      });
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#f8f6ec", minHeight: "100vh" }}>
      {/* ── Header ── */}
      <div>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 30px 24px" }}>
          <Link
            href="/volunteer"
            style={{ fontSize: 13, color: "#56a1d2", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}
          >
            <i className="fa fa-arrow-left" aria-hidden="true" /> All Roles
          </Link>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111", margin: "0 0 10px", lineHeight: 1.2 }}>
                {role.title}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "#fff",
                  background: role.chapter_code ? "#d2b356" : "#9ca3af",
                  padding: "3px 8px",
                  borderRadius: 4,
                }}>
                  {role.chapter_name ?? "Global"}
                </span>
                {role.time_commitment && (
                  <span style={{ fontSize: 14, color: "#56a1d2", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fa fa-clock-o" aria-hidden="true" />
                    {role.time_commitment}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 30px 60px" }}>

        {/* About the Ai Salon */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "20px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af", margin: "0 0 8px" }}>
            About the Ai Salon
          </p>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>
            {ABOUT_AI_SALON}
          </p>
        </div>

        {/* Role description */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p style={{ fontSize: 14, color: "#444", lineHeight: 1.75, margin: "0 0 12px" }}>{children}</p>
              ),
              h2: ({ children }) => (
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "20px 0 8px" }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "16px 0 6px" }}>{children}</h3>
              ),
              ul: ({ children }) => (
                <ul style={{ listStyleType: "disc", paddingLeft: 20, margin: "6px 0 12px", color: "#444" }}>{children}</ul>
              ),
              li: ({ children }) => (
                <li style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 2 }}>{children}</li>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 700, color: "#111" }}>{children}</strong>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2", textDecoration: "none", fontWeight: 600 }}>{children}</a>
              ),
            }}
          >
            {role.description}
          </ReactMarkdown>
        </div>

        {/* CTA / Form */}
        {submitted ? (
          <div style={{ background: "#fff", borderRadius: 10, padding: "40px 28px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <i className="fa fa-check-circle" style={{ fontSize: 44, color: "#16a34a", marginBottom: 14, display: "block" }} />
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 8 }}>Thank you for your interest!</h3>
            <p style={{ fontSize: 15, color: "#696969", marginBottom: 20 }}>
              We&apos;ve received your application for <strong>{role.title}</strong>. A member of our team will review it and get back to you.
            </p>
            <Link href="/volunteer" style={{ fontSize: 14, color: "#56a1d2", textDecoration: "none", fontWeight: 600 }}>
              <i className="fa fa-arrow-left" style={{ marginRight: 6 }} /> View Other Roles
            </Link>
          </div>
        ) : !showForm ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ fontSize: 15, padding: "13px 36px" }}>
              Express Interest in This Role
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ background: "#fff", borderRadius: 10, padding: "28px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4, marginTop: 0 }}>Express Interest</h2>
            <p style={{ fontSize: 14, color: "#696969", marginBottom: 24 }}>
              Applying for: <strong>{role.title}</strong>
            </p>

            <div className="host-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="name">Full Name <span style={{ color: "#dc2626" }}>*</span></label>
                <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="email">Email <span style={{ color: "#dc2626" }}>*</span></label>
                <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="city">City <span style={{ color: "#dc2626" }}>*</span></label>
                <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London..." style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="linkedin">LinkedIn <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                <input id="linkedin" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="resume">Resume URL <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                <input id="resume" type="url" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)} placeholder="Google Doc, Dropbox, etc." style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="website">Personal Website <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                <input id="website" type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yoursite.com" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="why">Why are you interested in this role? <span style={{ color: "#dc2626" }}>*</span></label>
              <textarea
                id="why"
                required
                value={whyInterested}
                onChange={e => setWhyInterested(e.target.value)}
                rows={4}
                placeholder="Tell us what excites you about this role..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="experience">Relevant Experience <span style={{ color: "#dc2626" }}>*</span></label>
              <textarea
                id="experience"
                required
                value={relevantExperience}
                onChange={e => setRelevantExperience(e.target.value)}
                rows={3}
                placeholder="Share relevant experience, skills, or background..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Availability <span style={{ color: "#dc2626" }}>*</span></label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {[
                  { value: "<2h/week", label: "Less than 2 hours/week" },
                  { value: "2-4h/week", label: "2-4 hours/week" },
                  { value: "4-6h/week", label: "4-6 hours/week" },
                  { value: "6+h/week", label: "6+ hours/week" },
                ].map(({ value, label }) => (
                  <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 400, fontSize: 14, color: "#111" }}>
                    <input
                      type="radio"
                      name="availability"
                      value={value}
                      required
                      checked={availability === value}
                      onChange={() => setAvailability(value)}
                      style={{ accentColor: "#56a1d2", width: 16, height: 16 }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle} htmlFor="howheard">How did you hear about us? <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
              <input id="howheard" type="text" value={howHeard} onChange={e => setHowHeard(e.target.value)} placeholder="e.g. friend, social media, event..." style={inputStyle} />
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: "100%", textAlign: "center", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "block" }}
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
