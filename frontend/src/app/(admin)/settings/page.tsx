"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { toast } from "@/lib/toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Known-good Gemini model names, shown as a hint under the free-text model field.
const KNOWN_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

// System settings for superadmin
const SYSTEM_SETTINGS = [
  {
    section: "Substack",
    icon: "fa-send",
    description: "Configure Substack credentials for automated publishing.",
    fields: [
      { key: "substack_publication_url", label: "Publication URL", placeholder: "https://yourpub.substack.com", type: "text" as const },
      { key: "substack_email", label: "Email", placeholder: "your@email.com", type: "text" as const },
      { key: "substack_password", label: "Password", placeholder: "Substack password", type: "password" as const },
    ],
  },
  {
    section: "Social Media (Late.dev)",
    icon: "fa-share-alt",
    description: "Configure Late.dev credentials for social media posting.",
    fields: [
      { key: "late_api_key", label: "API Key", placeholder: "Late.dev API key", type: "password" as const },
      { key: "late_account_id", label: "Account ID", placeholder: "LinkedIn account ID from Late.dev", type: "text" as const },
    ],
  },
];

interface FeatureFlag {
  name: string;
  value: boolean;
  description: string;
}

function FeatureFlagsSection({ token }: { token: string }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function load() {
    if (!token) return;
    fetch(`${API_URL}/admin/feature-flags`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setFlags)
      .catch(console.error);
  }

  useEffect(load, [token]);

  async function toggle(flag: FeatureFlag) {
    setSavingKey(flag.name);
    const r = await fetch(`${API_URL}/admin/feature-flags/${flag.name}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: !flag.value }),
    });
    setSavingKey(null);
    if (r.ok) {
      toast.success(`${flag.name} ${!flag.value ? "enabled" : "disabled"}`);
      load();
    } else {
      toast.error("Failed to update flag");
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <i className="fa fa-flag" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Feature Flags</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
        Toggle public-facing features. Changes apply within ~30 seconds.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {flags.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No feature flags configured.</p>
        ) : (
          flags.map((flag) => (
            <div
              key={flag.name}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                paddingTop: 12,
                borderTop: "1px solid #f1f1ec",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{flag.name}</div>
                <div style={{ fontSize: 12, color: "#696969", marginTop: 2, lineHeight: 1.5 }}>
                  {flag.description}
                </div>
              </div>
              <button
                onClick={() => toggle(flag)}
                disabled={savingKey === flag.name}
                aria-pressed={flag.value}
                style={{
                  position: "relative",
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: flag.value ? "#56a1d2" : "#d1d5db",
                  cursor: savingKey === flag.name ? "wait" : "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: flag.value ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.15s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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

function SystemSettingSection({
  section,
  icon,
  description,
  fields,
  configuredKeys,
  token,
  onRefresh,
}: {
  section: string;
  icon: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type: "text" | "password" }[];
  configuredKeys: Set<string>;
  token: string;
  onRefresh: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(key: string) {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    const r = await fetch(`${API_URL}/admin/system-settings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaving(false);
    if (!r.ok) {
      setError("Failed to save.");
      toast.error("Failed to save setting");
      return;
    }
    toast.success("Setting saved");
    setValue("");
    setEditingKey(null);
    onRefresh();
  }

  async function handleDelete(key: string) {
    const r = await fetch(`${API_URL}/admin/system-settings/${key}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      toast.success("Setting removed");
    } else {
      toast.error("Failed to remove setting");
    }
    onRefresh();
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <i className={`fa ${icon}`} style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{section}</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>{description}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fields.map((field) => {
          const isSet = configuredKeys.has(field.key);
          return (
            <div key={field.key}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{field.label}</span>
                  <StatusBadge active={isSet} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setEditingKey(field.key); setValue(""); setError(""); }}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1.5px solid #56a1d2",
                      color: "#56a1d2",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {isSet ? "Update" : "Set"}
                  </button>
                  {isSet && (
                    <button
                      onClick={() => handleDelete(field.key)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "5px 12px",
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
              {editingKey === field.key && (
                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(field.key)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontSize: 13,
                      border: "1.5px solid #d1d5db",
                      borderRadius: 6,
                      outline: "none",
                      fontFamily: field.type === "password" ? "monospace" : "inherit",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSave(field.key)}
                    disabled={saving}
                    style={{
                      padding: "8px 16px",
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
                    onClick={() => { setEditingKey(null); setValue(""); }}
                    style={{
                      padding: "8px 12px",
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
              {error && editingKey === field.key && (
                <p style={{ fontSize: 13, color: "#ef4444", marginTop: 6 }}>{error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChangePasswordSection({ token }: { token: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (next.length < 12) {
      toast.error("New password must be at least 12 characters");
      return;
    }
    setSaving(true);
    const r = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    setSaving(false);
    if (r.status === 204) {
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
      return;
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 400) {
      toast.error(body.detail ?? "Current password is incorrect");
    } else if (r.status === 422) {
      toast.error("New password doesn't meet strength requirements");
    } else {
      toast.error("Failed to update password");
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "9px 12px",
    fontSize: 14,
    border: "1.5px solid #d1d5db",
    borderRadius: 6,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <i className="fa fa-lock" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Change Password</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
        At least 12 characters, including upper- and lower-case letters and a number.
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          style={{
            alignSelf: "flex-start",
            fontSize: 13,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 6,
            background: "#56a1d2",
            color: "#fff",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            opacity: !current || !next || !confirm ? 0.5 : 1,
          }}
        >
          {saving ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

interface ProcessingConfig {
  assemblyai_set: boolean;
  google_set: boolean;
  model: string;
  model_source: string;
}

function AiProcessingSection({ token }: { token: string }) {
  const [config, setConfig] = useState<ProcessingConfig | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function load() {
    if (!token) return;
    fetch(`${API_URL}/admin/processing-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(console.error);
  }
  useEffect(load, [token]);

  function startEdit(field: string, initial = "") {
    setEditing(field);
    setDraft(initial);
    setResult(null);
  }

  // Verify the candidate value with a live test, and only persist it if the test passes.
  async function verifyAndSave(target: string, settingKey: string) {
    if (!draft.trim()) return;
    setBusy(true);
    setResult(null);
    const test = await fetch(`${API_URL}/admin/processing/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target, value: draft }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, message: "Verification request failed." }));
    if (!test.ok) {
      setBusy(false);
      setResult(test);
      return;
    }
    const save = await fetch(`${API_URL}/admin/system-settings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: draft }),
    });
    setBusy(false);
    if (!save.ok) {
      setResult({ ok: false, message: "Verified, but saving failed." });
      return;
    }
    toast.success("Verified and saved");
    setEditing(null);
    setDraft("");
    setResult(null);
    load();
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: "9px 13px", fontSize: 14, border: "1.5px solid #d1d5db",
    borderRadius: 6, outline: "none",
  };
  const primaryBtn: React.CSSProperties = {
    padding: "9px 18px", fontSize: 13, fontWeight: 700, background: "#56a1d2",
    color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
  };
  const outlineBtn: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 6,
    border: "1.5px solid #56a1d2", color: "#56a1d2", background: "transparent", cursor: "pointer",
  };
  const cancelBtn: React.CSSProperties = {
    padding: "9px 14px", fontSize: 13, background: "transparent",
    border: "1.5px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#696969",
  };

  const keyFields = [
    { field: "assemblyai", settingKey: "assemblyai_api_key", target: "assemblyai", label: "AssemblyAI API Key", isSet: config?.assemblyai_set, placeholder: "Paste AssemblyAI key" },
    { field: "google", settingKey: "google_api_key", target: "google", label: "Google AI API Key", isSet: config?.google_set, placeholder: "Paste Google AI key" },
  ];

  function resultLine() {
    if (!result) return null;
    return (
      <p style={{ fontSize: 13, marginTop: 8, color: result.ok ? "#16a34a" : "#ef4444" }}>
        {result.ok ? "✓ " : "✕ "}{result.message}
      </p>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <i className="fa fa-cogs" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>AI Processing</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
        Platform-wide keys and model used to transcribe and write up every conversation. Hosts
        don&apos;t set their own keys. Each value is verified with a live test before it&apos;s saved.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {keyFields.map((f) => (
          <div key={f.field}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{f.label}</span>
                <StatusBadge active={!!f.isSet} />
              </div>
              <button onClick={() => startEdit(f.field)} style={outlineBtn}>
                {f.isSet ? "Update" : "Set key"}
              </button>
            </div>
            {editing === f.field && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="password"
                    placeholder={f.placeholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                    autoFocus
                  />
                  <button onClick={() => verifyAndSave(f.target, f.settingKey)} disabled={busy} style={primaryBtn}>
                    {busy ? "Verifying…" : "Verify & Save"}
                  </button>
                  <button onClick={() => { setEditing(null); setResult(null); }} style={cancelBtn}>Cancel</button>
                </div>
                {resultLine()}
              </div>
            )}
          </div>
        ))}

        {/* Processing model — free text, verified before save */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Processing Model</span>
              {config && (
                <span style={{ fontSize: 12, color: "#696969", fontFamily: "monospace" }}>{config.model}</span>
              )}
              {config && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                    background: config.model_source === "setting" ? "#dcfce7" : "#f3f4f6",
                    color: config.model_source === "setting" ? "#16a34a" : "#9ca3af",
                  }}
                >
                  {config.model_source === "setting" ? "Custom" : "Default"}
                </span>
              )}
            </div>
            <button onClick={() => startEdit("model", config?.model ?? "")} style={outlineBtn}>Change</button>
          </div>
          {editing === "model" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="gemini-3.1-flash-lite"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  autoFocus
                />
                <button onClick={() => verifyAndSave("model", "article_llm_model")} disabled={busy} style={primaryBtn}>
                  {busy ? "Verifying…" : "Verify & Save"}
                </button>
                <button onClick={() => { setEditing(null); setResult(null); }} style={cancelBtn}>Cancel</button>
              </div>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>
                Known models: {KNOWN_MODELS.join(", ")}. Saving runs a quick test generation with the
                saved Google key, so an unsupported name is caught here.
              </p>
              {resultLine()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [systemKeys, setSystemKeys] = useState<Set<string>>(new Set());
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [schedulingUrlSaving, setSchedulingUrlSaving] = useState(false);
  const [schedulingUrlEdit, setSchedulingUrlEdit] = useState(false);

  const token = (session as any)?.accessToken;
  const isSuperadmin = (session?.user as any)?.role === "superadmin";
  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data.scheduling_url) setSchedulingUrl(data.scheduling_url); })
      .catch(console.error);
  }, [token]);

  function loadSystemSettings() {
    if (!token || !isSuperadmin) return;
    fetch(`${API_URL}/admin/system-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { key: string; has_value: boolean }[]) => {
        setSystemKeys(new Set(data.map((s) => s.key)));
      })
      .catch(console.error);
  }

  useEffect(() => { loadSystemSettings(); }, [token, isSuperadmin]);

  async function saveSchedulingUrl() {
    setSchedulingUrlSaving(true);
    const r = await fetch(`${API_URL}/admin/me/scheduling-url`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scheduling_url: schedulingUrl || null }),
    });
    setSchedulingUrlSaving(false);
    if (r.ok) {
      toast.success("Scheduling link saved");
      setSchedulingUrlEdit(false);
    } else {
      toast.error("Failed to save scheduling link");
    }
  }

  if (status === "loading") return null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Settings</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 40 }}>
        Manage your account and platform configuration.
      </p>

      {token && (
        <div style={{ marginBottom: 32 }}>
          <ChangePasswordSection token={token} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Scheduling URL (chapter leads + superadmin) */}
        {(userRole === "chapter_lead" || userRole === "superadmin") && (
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "20px 24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <i className="fa fa-calendar" style={{ color: "#56a1d2", fontSize: 15 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>1:1 Scheduling Link</span>
              {schedulingUrl && !schedulingUrlEdit && <StatusBadge active={true} />}
            </div>
            <p style={{ fontSize: 13, color: "#696969", marginBottom: 14 }}>
              Add your booking link so hosts can schedule 1:1 meetings with you. Use{" "}
              <a href="https://cal.com" target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2" }}>cal.com</a>,{" "}
              <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2" }}>Calendly</a>, or{" "}
              Google Calendar appointment pages.
            </p>
            {schedulingUrlEdit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="url"
                  value={schedulingUrl}
                  onChange={(e) => setSchedulingUrl(e.target.value)}
                  placeholder="https://cal.com/yourname/meeting"
                  style={{ fontSize: 13, padding: "8px 12px", borderRadius: 6, border: "1.5px solid #d1d5db", outline: "none", width: "100%" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveSchedulingUrl}
                    disabled={schedulingUrlSaving}
                    style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "none", background: "#56a1d2", color: "#fff", cursor: "pointer" }}
                  >
                    {schedulingUrlSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setSchedulingUrlEdit(false)}
                    style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "1.5px solid #d1d5db", background: "transparent", color: "#696969", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {schedulingUrl ? (
                  <a href={schedulingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#56a1d2", wordBreak: "break-all" }}>
                    {schedulingUrl}
                  </a>
                ) : (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>No link set</span>
                )}
                <button
                  onClick={() => setSchedulingUrlEdit(true)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1.5px solid #56a1d2", color: "#56a1d2", background: "transparent", cursor: "pointer", flexShrink: 0 }}
                >
                  {schedulingUrl ? "Update" : "Set link"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* System settings (superadmin only) */}
        {isSuperadmin && (
          <>
            <div style={{ borderTop: "1px solid #e8e4d8", margin: "12px 0", paddingTop: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }}>Platform Settings</h2>
              <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
                Superadmin-only. Configure AI processing, publishing, and social integrations.
              </p>
            </div>
            <AiProcessingSection token={token} />
            <FeatureFlagsSection token={token} />
            {SYSTEM_SETTINGS.map((cfg) => (
              <SystemSettingSection
                key={cfg.section}
                {...cfg}
                configuredKeys={systemKeys}
                token={token}
                onRefresh={loadSystemSettings}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
