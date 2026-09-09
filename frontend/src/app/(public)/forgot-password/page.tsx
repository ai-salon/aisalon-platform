"use client";
import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #e1e1e1", borderRadius: 6,
  fontSize: 15, color: "#111", outline: "none", boxSizing: "border-box",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const r = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (r.ok) {
        setState("sent");
        return;
      }
      const body = await r.json().catch(() => ({}));
      setError(
        typeof body.detail === "string"
          ? body.detail
          : r.status === 429
            ? "Too many requests. Please wait a few minutes and try again."
            : "Something went wrong. Please try again.",
      );
      setState("error");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div style={{ minHeight: "60vh", background: "#f8f6ec", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "40px", width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 6, textAlign: "center" }}>
          Reset your password
        </h1>
        {state === "sent" ? (
          <>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 20 }}>
              If <b>{email.trim()}</b> has an account, a reset link is on its way. It expires in 24 hours.
            </p>
            <p style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
              <Link href="/login" style={{ color: "#56a1d2", fontWeight: 600 }}>Back to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 24 }}>
              Enter your login email and we&apos;ll send you a link to choose a new password.
            </p>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }} htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ ...inputStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 16, textAlign: "center" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="btn-primary"
              style={{ width: "100%", textAlign: "center", opacity: state === "sending" ? 0.7 : 1 }}
            >
              {state === "sending" ? "Sending…" : "SEND RESET LINK"}
            </button>
            <p style={{ fontSize: 13, textAlign: "center", margin: "18px 0 0" }}>
              <Link href="/login" style={{ color: "#56a1d2", fontWeight: 600 }}>Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
