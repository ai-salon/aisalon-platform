"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string;
};

const EDITABLE_FIELDS: { key: keyof Chapter; label: string; multiline?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Page Title" },
  { key: "tagline", label: "Tagline" },
  { key: "description", label: "Description", multiline: true },
  { key: "about", label: "About", multiline: true },
  { key: "event_link", label: "Event Link" },
  { key: "calendar_embed", label: "Calendar Embed URL" },
  { key: "events_description", label: "Events Description", multiline: true },
];

export default function ChapterEditPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [form, setForm] = useState<Partial<Chapter>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token || !code) return;
    fetch(`${API_URL}/chapters/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setChapter(data);
        setForm(data);
      })
      .catch(console.error);
  }, [token, code]);

  async function handleSave() {
    if (!chapter) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const r = await fetch(`${API_URL}/admin/chapters/${chapter.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail ?? "Failed to save.");
      return;
    }
    const updated = await r.json();
    setChapter(updated);
    setForm(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (status === "loading" || !chapter) return null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <Link
        href="/chapters"
        style={{ fontSize: 13, color: "#56a1d2", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}
      >
        <i className="fa fa-arrow-left" />
        All chapters
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#d2b356" }}>
          {chapter.code}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 12,
            background: chapter.status === "active" ? "#dcfce7" : "#f3f4f6",
            color: chapter.status === "active" ? "#16a34a" : "#6b7280",
          }}
        >
          {chapter.status}
        </span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 32px" }}>
        {chapter.name}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
            Status
          </label>
          <select
            value={(form.status as string) ?? "draft"}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            style={{
              width: "100%",
              padding: "10px 13px",
              fontSize: 14,
              border: "1.5px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              boxSizing: "border-box",
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {EDITABLE_FIELDS.map(({ key, label, multiline }) => (
          <div key={key}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              {label}
            </label>
            {multiline ? (
              <textarea
                value={(form[key] as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 13px",
                  fontSize: 14,
                  border: "1.5px solid #d1d5db",
                  borderRadius: 6,
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <input
                value={(form[key] as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 13px",
                  fontSize: 14,
                  border: "1.5px solid #d1d5db",
                  borderRadius: 6,
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        ))}

        {error && <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "11px 24px",
              fontSize: 14,
              fontWeight: 700,
              background: saving ? "#d1d5db" : "#56a1d2",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
              <i className="fa fa-check" style={{ marginRight: 5 }} />Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
