"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * One-time invite link generator. Chapter leads get a host invite for their own
 * chapter (enforced server-side); superadmins pick chapter and role.
 * Rendered on the dashboard and on the Team page.
 */
export default function InviteCard() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string } | null)?.accessToken;
  const user = session?.user as unknown as { role?: string; chapterId?: string } | undefined;
  const userRole = user?.role;
  const userChapterId = user?.chapterId;
  const isSuperadmin = userRole === "superadmin";

  const [chapters, setChapters] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState(userChapterId ?? "");
  const [selectedRole, setSelectedRole] = useState("host");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperadmin || !token) return;
    fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((c) => {
        setChapters(c);
        if (!selectedChapterId && c.length > 0) setSelectedChapterId(c[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin, token]);

  const chapterId = isSuperadmin ? selectedChapterId : userChapterId;

  async function createInvite() {
    if (!token || !chapterId) return;
    setCreating(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/admin/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_id: chapterId, role: selectedRole, max_uses: 1 }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.detail ?? "Failed to create invite.");
        setCreating(false);
        return;
      }
      const invite = await r.json();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}/register?invite=${invite.token}`);
    } catch {
      setError("Something went wrong.");
    }
    setCreating(false);
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "2px solid #d2b356",
        padding: "18px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>✉️</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Invite a Member</span>
      </div>
      <p style={{ fontSize: 12, color: "#696969", margin: "0 0 12px", lineHeight: 1.5 }}>
        Generate a one-time invite link for someone to register.
      </p>

      {!inviteUrl ? (
        <>
          {isSuperadmin && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                style={{ flex: 1, minWidth: 100, padding: "6px 8px", fontSize: 12, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ padding: "6px 8px", fontSize: 12, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                <option value="host">Host</option>
                <option value="chapter_lead">Chapter Lead</option>
              </select>
            </div>
          )}
          <button
            onClick={createInvite}
            disabled={creating || !chapterId}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              background: "#d2b356",
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating…" : "Create Invite Link"}
          </button>
          {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</p>}
        </>
      ) : (
        <div>
          <div
            style={{
              background: "#f8f6ec",
              border: "1px solid #ede9d8",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              wordBreak: "break-all",
              color: "#333",
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            {inviteUrl}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copyLink}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #d2b356",
                background: copied ? "#d2b356" : "#fff",
                color: copied ? "#fff" : "#d2b356",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={() => { setInviteUrl(null); setCopied(false); }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#696969",
                cursor: "pointer",
              }}
            >
              New Invite
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
