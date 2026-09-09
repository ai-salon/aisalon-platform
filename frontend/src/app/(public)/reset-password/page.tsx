"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #e1e1e1", borderRadius: 6,
  fontSize: 15, color: "#111", outline: "none", boxSizing: "border-box",
};

function ResetInner() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setState("saving");
    try {
      const r = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (r.ok) {
        setState("done");
        return;
      }
      const body = await r.json().catch(() => ({}));
      const detail = body?.detail;
      if (Array.isArray(detail)) {
        // FastAPI validation error: surface the password rule that failed.
        setError(String(detail[0]?.msg ?? "Password doesn't meet the requirements").replace(/^Value error, /, ""));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setState("idle");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <div style={{ minHeight: "60vh", background: "#f8f6ec", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "40px", width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 6, textAlign: "center" }}>
          Choose a password
        </h1>
        {!token ? (
          <p style={{ fontSize: 14, color: "#696969", textAlign: "center", margin: 0 }}>
            This link is missing its token.{" "}
            <Link href="/forgot-password" style={{ color: "#56a1d2", fontWeight: 600 }}>Request a new one</Link>.
          </p>
        ) : state === "done" ? (
          <>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 20 }}>
              Your password is set. You can sign in now.
            </p>
            <Link href="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
              SIGN IN
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 24 }}>
              At least 12 characters with an uppercase letter, a lowercase letter, and a number.
            </p>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }} htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }} htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={{ ...inputStyle, marginBottom: 20 }}
            />
            {error && (
              <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 16, textAlign: "center" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={state === "saving"}
              className="btn-primary"
              style={{ width: "100%", textAlign: "center", opacity: state === "saving" ? 0.7 : 1 }}
            >
              {state === "saving" ? "Saving…" : "SET PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetInner /></Suspense>;
}
