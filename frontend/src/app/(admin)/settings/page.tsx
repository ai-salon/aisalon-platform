"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PROVIDERS = ["assemblyai", "anthropic", "google"] as const;
type Provider = (typeof PROVIDERS)[number];

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 12,
        background: active ? "#dcfce7" : "#f3f4f6",
        color: active ? "#16a34a" : "#9ca3af",
      }}
    >
      {active ? "Set" : "Not set"}
    </span>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<{ provider: string; has_key: boolean }[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setKeys)
      .catch(console.error);
  }, [token]);

  function hasKey(provider: Provider) {
    return keys.some((k) => k.provider === provider && k.has_key);
  }

  async function handleSave(provider: Provider) {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    const r = await fetch(`${API_URL}/admin/api-keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key: value }),
    });
    setSaving(false);
    if (!r.ok) {
      setError("Failed to save key.");
      return;
    }
    setValue("");
    setEditing(null);
    const updated = await fetch(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    setKeys(updated);
  }

  async function handleDelete(provider: Provider) {
    const r = await fetch(`${API_URL}/admin/api-keys/${provider}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setKeys((prev) => prev.filter((k) => k.provider !== provider));
    }
  }

  if (status === "loading") return null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Settings</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 40 }}>
        Manage your API keys. Keys are encrypted at rest and never returned in responses.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {PROVIDERS.map((provider) => (
          <div
            key={provider}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "20px 24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", color: "#111" }}>
                  {provider}
                </span>
                <StatusBadge active={hasKey(provider)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setEditing(provider); setValue(""); setError(""); }}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1.5px solid #56a1d2",
                    color: "#56a1d2",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  {hasKey(provider) ? "Update" : "Set key"}
                </button>
                {hasKey(provider) && (
                  <button
                    onClick={() => handleDelete(provider)}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1.5px solid #fca5a5",
                      color: "#ef4444",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {editing === provider && (
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <input
                  type="password"
                  placeholder={`Enter ${provider} API key`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave(provider)}
                  style={{
                    flex: 1,
                    padding: "9px 13px",
                    fontSize: 14,
                    border: "1.5px solid #d1d5db",
                    borderRadius: 6,
                    outline: "none",
                    fontFamily: "monospace",
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleSave(provider)}
                  disabled={saving}
                  style={{
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    background: "#56a1d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(null); setValue(""); }}
                  style={{
                    padding: "9px 14px",
                    fontSize: 13,
                    background: "transparent",
                    border: "1.5px solid #d1d5db",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "#696969",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {error && editing === provider && (
              <p style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
