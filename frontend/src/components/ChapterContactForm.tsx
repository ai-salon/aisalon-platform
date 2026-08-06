"use client";
// frontend/src/components/ChapterContactForm.tsx
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ChapterContactForm({ code, chapterName }: { code: string; chapterName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — hidden field
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch(`${API_URL}/chapters/${code}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || null, email, message, website: website || null }),
      });
      setState(r.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="section-subtitle">
        Message sent — the {chapterName} chapter leads will get back to you.
      </p>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 640 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" style={inputStyle} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" required style={inputStyle} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message" required minLength={10} maxLength={5000} rows={4} style={{ ...inputStyle, gridColumn: "1 / 3", resize: "vertical" }} />
      {/* Honeypot: visually hidden, real bots fill it */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, height: 0, width: 0, opacity: 0 }} placeholder="Website" />
      <div style={{ gridColumn: "1 / 3" }}>
        <button type="submit" className="btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send Message"}
        </button>
        {state === "error" && (
          <span style={{ marginLeft: 12, color: "#b91c1c", fontSize: 14 }}>
            Something went wrong — please try again.
          </span>
        )}
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6,
  padding: "12px 14px", fontSize: 15, fontFamily: "inherit", color: "#111",
};
