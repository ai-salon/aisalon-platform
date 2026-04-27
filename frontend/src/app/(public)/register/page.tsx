"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";

  const [inviteInfo, setInviteInfo] = useState<{ chapter_name: string; role: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      setInviteError("No invite token provided.");
      return;
    }
    fetch(`${API_URL}/auth/invite/${inviteToken}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setInviteError(body.detail ?? "Invalid or expired invite.");
          return;
        }
        const data = await res.json();
        setInviteInfo(data);
      })
      .catch(() => setInviteError("Could not validate invite."));
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_token: inviteToken,
          username,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? "Registration failed.");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const loginRes = await signIn("credentials", {
        identifier: username,
        password,
        redirect: false,
      });
      setLoading(false);

      if (loginRes?.error) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push("/login");
      } else {
        router.push("/profile/complete");
      }
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f6ec",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "48px 40px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/images/logo-2-300w.png" alt="Ai Salon" width={120} height={48} style={{ height: 48, width: "auto" }} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 6, textAlign: "center" }}>
          Join the Ai Salon
        </h1>

        {inviteError ? (
          <p style={{ fontSize: 14, color: "#dc2626", textAlign: "center", marginTop: 24 }}>
            {inviteError}
          </p>
        ) : !inviteInfo ? (
          <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginTop: 24 }}>
            Validating invite...
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 8 }}>
              You&apos;ve been invited to join as a{" "}
              <span style={{ fontWeight: 700, color: "#56a1d2", textTransform: "capitalize" }}>
                {inviteInfo.role.replace("_", " ")}
              </span>
            </p>
            <p style={{ fontSize: 14, color: "#696969", textAlign: "center", marginBottom: 32 }}>
              Chapter:{" "}
              <span style={{ fontWeight: 700, color: "#d2b356" }}>{inviteInfo.chapter_name}</span>
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_]+"
                  title="Letters, numbers, and underscores only"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e1e1e1",
                    borderRadius: 6,
                    fontSize: 15,
                    color: "#111",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e1e1e1",
                    borderRadius: 6,
                    fontSize: 15,
                    color: "#111",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e1e1e1",
                    borderRadius: 6,
                    fontSize: 15,
                    color: "#111",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 16, textAlign: "center" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: "100%", textAlign: "center", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Creating account…" : "CREATE ACCOUNT"}
              </button>
            </form>

            <p style={{ fontSize: 13, color: "#696969", textAlign: "center", marginTop: 20 }}>
              Already have an account?{" "}
              <a href="/login" style={{ color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}>
                Sign in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
