"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { toast } from "@/lib/toast";
import { validateApiKey } from "@/lib/validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PROVIDERS = ["assemblyai", "google"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_HELP: Record<Provider, { label: string; description: string; steps: string; url: string; urlLabel: string }> = {
  assemblyai: {
    label: "AssemblyAI",
    description: "Used to transcribe your audio recordings into text.",
    steps: "Sign up → go to the API Keys tab in the left sidebar → copy your key.",
    url: "https://app.assemblyai.com",
    urlLabel: "app.assemblyai.com",
  },
  google: {
    label: "Google AI",
    description: "Used to generate the article and anonymize the transcript.",
    steps: "Sign in with Google → click Create API key → copy it.",
    url: "https://aistudio.google.com/apikey",
    urlLabel: "aistudio.google.com/apikey",
  },
};

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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<{ provider: string; has_key: boolean }[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [helpOpen, setHelpOpen] = useState<Provider | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    fetch(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setKeys)
      .catch(console.error);
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

  function hasKey(provider: Provider) {
    return keys.some((k) => k.provider === provider && k.has_key);
  }

  async function handleSave(provider: Provider) {
    const validationError = validateApiKey(value);
    if (validationError) {
      setError(validationError);
      return;
    }
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
      toast.error("Failed to save API key");
      return;
    }
    toast.success("API key saved");
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
      toast.success("API key removed");
    } else {
      toast.error("Failed to remove API key");
    }
  }

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
        Manage your API keys. Keys are encrypted at rest and never returned in responses.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {PROVIDERS.map((provider) => {
          const help = PROVIDER_HELP[provider];
          const isHelpOpen = helpOpen === provider;
          return (
            <div
              key={provider}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "20px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                    {help.label}
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

              {/* Key input */}
              {editing === provider && (
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <input
                    type="password"
                    placeholder={`Enter ${help.label} API key`}
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

              {/* Help toggle */}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setHelpOpen(isHelpOpen ? null : provider)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#56a1d2",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <i className={`fa fa-chevron-${isHelpOpen ? "up" : "down"}`} style={{ fontSize: 10 }} />
                  Where do I get this key?
                </button>
                {isHelpOpen && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#f8f6ec",
                      border: "1px solid #e8e4d8",
                      borderRadius: 6,
                      padding: "12px 16px",
                      fontSize: 13,
                      color: "#444",
                      lineHeight: 1.6,
                    }}
                  >
                    <p style={{ margin: "0 0 6px", color: "#696969" }}>{help.description}</p>
                    <p style={{ margin: "0 0 6px" }}>
                      Go to{" "}
                      <a
                        href={help.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#56a1d2", fontWeight: 600 }}
                      >
                        {help.urlLabel}
                      </a>
                      {" "}→ {help.steps}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

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
                Superadmin-only. Configure publishing and social integrations.
              </p>
            </div>
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
