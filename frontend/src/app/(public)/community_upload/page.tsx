"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export default function CommunityUploadPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [topicText, setTopicText] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((r) => r.json())
      .then((data: Topic[]) => setTopics(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg("");

    const fd = new FormData();
    if (!file) return;
    fd.append("file", file);
    fd.append("city", city);
    if (topicId && topicId !== "__other__") fd.append("topic_id", topicId);
    if (topicText) fd.append("topic_text", topicText);
    if (name) fd.append("name", name);
    if (email) fd.append("email", email);
    if (notes) fd.append("notes", notes);
    fd.append("website", website); // honeypot — empty for real users

    try {
      const r = await fetch(`${API}/community/upload`, { method: "POST", body: fd });
      if (r.status === 201 || r.status === 200) {
        setFormState("success");
      } else if (r.status === 429) {
        setErrorMsg("Too many uploads — please try again later.");
        setFormState("error");
      } else {
        const body = await r.json().catch(() => ({}));
        setErrorMsg(body.detail || "Something went wrong — please try again.");
        setFormState("error");
      }
    } catch {
      setErrorMsg("Something went wrong — please try again.");
      setFormState("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #ddd",
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
    color: "#333",
  };

  if (formState === "success") {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <i className="fa fa-check-circle" style={{ fontSize: 48, color: "#56a1d2", marginBottom: 20, display: "block" }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Recording submitted!</h2>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 32 }}>
          Thanks for contributing to the Ai Salon&apos;s broader community knowledge base!
        </p>
        <Link href="/start" style={{ color: "#56a1d2", fontWeight: 600, fontSize: 15 }}>
          ← Back to hosting guide
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10, color: "#111" }}>
        Share a Recording
      </h1>
      <p style={{ fontSize: 16, color: "#555", lineHeight: 1.6, marginBottom: 36 }}>
        Record your Ai Salon conversation and contribute it to our community knowledge base.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Honeypot — hidden from real users */}
        <div style={{ display: "none" }} aria-hidden="true">
          <input
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* Topic */}
        <div>
          <label style={labelStyle}>
            Topic <span style={{ color: "#dc2626" }}>*</span>
          </label>
          {topics.length > 0 ? (
            <>
              <select
                required
                value={topicId}
                onChange={(e) => {
                  setTopicId(e.target.value);
                  if (e.target.value !== "__other__") setTopicText("");
                }}
                style={{ ...inputStyle, background: "white" }}
              >
                <option value="">Select a topic…</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
                <option value="__other__">Other (specify)</option>
              </select>
              {topicId === "__other__" && (
                <input
                  type="text"
                  required
                  placeholder="What did you discuss?"
                  value={topicText}
                  onChange={(e) => setTopicText(e.target.value)}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
              )}
            </>
          ) : (
            <input
              type="text"
              required
              placeholder="What did you discuss?"
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        {/* City */}
        <div>
          <label style={labelStyle}>
            City <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Where did this take place?"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Audio file */}
        <div>
          <label style={labelStyle}>
            Recording <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            required
            accept=".mp3,.wav,.m4a,.flac,.ogg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 14, color: "#333" }}
          />
          <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Accepts .mp3, .wav, .m4a, .flac, .ogg — max 150 MB
          </p>
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <textarea
            rows={3}
            placeholder="Anything you'd like us to know about this recording"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {errorMsg && (
          <p style={{ color: "#dc2626", fontSize: 14 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={formState === "submitting"}
          style={{
            background: formState === "submitting" ? "#9ec7e8" : "#56a1d2",
            color: "white",
            border: "none",
            padding: "13px 32px",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: formState === "submitting" ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {formState === "submitting" ? "Uploading…" : "Submit Recording"}
        </button>
      </form>
    </div>
  );
}
