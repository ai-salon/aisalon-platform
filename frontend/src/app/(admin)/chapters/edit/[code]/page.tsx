"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ChapterView from "@/components/ChapterView";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const NARROW_QUERY = "(max-width: 1099px)";

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string;
};

const EDITABLE_FIELDS: {
  key: keyof Chapter;
  label: string;
  hint: string;
  hintHref?: string;
  multiline?: boolean;
  maxLength?: number;
}[] = [
  { key: "name", label: "Name", hint: "chapter name — shown in the hero, nav, and homepage card" },
  { key: "title", label: "Page Title", hint: "big headline at the top of your chapter page" },
  { key: "tagline", label: "Tagline", hint: "appears under the page title" },
  {
    key: "description",
    label: "Card Blurb",
    hint: "short blurb on the homepage chapter card",
    hintHref: "/#chapters",
    multiline: true,
    maxLength: 120,
  },
  { key: "about", label: "About", hint: "the “About the chapter” section", multiline: true },
  { key: "event_link", label: "Event Link", hint: "the JOIN EVENTS button target (Luma)" },
  { key: "calendar_embed", label: "Calendar Embed URL", hint: "the events calendar iframe" },
  { key: "events_description", label: "Events Description", hint: "intro text in the Events section", multiline: true },
];

export default function ChapterEditPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [form, setForm] = useState<Partial<Chapter>>({});
  const [draftValues, setDraftValues] = useState<Chapter | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Narrow-viewport layout: stack panes and toggle between Edit/Preview.
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(NARROW_QUERY).matches : false
  );
  const [activePane, setActivePane] = useState<"edit" | "preview">("edit");

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
      .then((data: Chapter) => {
        setChapter(data);
        setForm(data);
        setDraftValues(data);
      })
      .catch(console.error);
  }, [token, code]);

  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Debounce raw form edits ~300ms before pushing them into the live preview,
  // so the (heavy) ChapterView tree doesn't re-render on every keystroke.
  useEffect(() => {
    if (!chapter) return;
    const t = setTimeout(() => {
      setDraftValues({ ...chapter, ...form } as Chapter);
    }, 300);
    return () => clearTimeout(t);
  }, [form, chapter]);

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

  const showEditPane = !isNarrow || activePane === "edit";
  const showPreviewPane = !isNarrow || activePane === "preview";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 30px" }}>
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
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 24px" }}>
        {chapter.name}
      </h1>

      {isNarrow && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["edit", "preview"] as const).map((pane) => (
            <button
              key={pane}
              onClick={() => setActivePane(pane)}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                border: `1.5px solid #56a1d2`,
                borderRadius: 6,
                background: activePane === pane ? "#56a1d2" : "#fff",
                color: activePane === pane ? "#fff" : "#56a1d2",
                cursor: "pointer",
              }}
            >
              {pane === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: isNarrow ? "column" : "row", gap: 28, alignItems: "flex-start" }}>
        {showEditPane && (
          <div style={{ flex: 1, minWidth: isNarrow ? 0 : 420, width: isNarrow ? "100%" : undefined }}>
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

              {EDITABLE_FIELDS.map(({ key, label, hint, hintHref, multiline, maxLength }) => {
                const value = (form[key] as string) ?? "";
                return (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                      {label}
                      {hint && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 400,
                            color: "#56a1d2",
                            textTransform: "none",
                            letterSpacing: "normal",
                            marginTop: 3,
                          }}
                        >
                          {hint}
                          {hintHref && (
                            <>
                              {" — "}
                              <a
                                href={hintHref}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#56a1d2", textDecoration: "underline" }}
                              >
                                see the cards →
                              </a>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                    {multiline ? (
                      <textarea
                        value={value}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        rows={4}
                        maxLength={maxLength}
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
                        value={value}
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
                    {maxLength !== undefined && (
                      <div
                        style={{
                          fontSize: 11,
                          color: value.length >= maxLength ? "#b91c1c" : "#9ca3af",
                          textAlign: "right",
                          marginTop: 3,
                        }}
                      >
                        {value.length}/{maxLength}
                      </div>
                    )}
                  </div>
                );
              })}

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
        )}

        {showPreviewPane && draftValues && (
          <div
            style={{
              flex: 1.2,
              width: isNarrow ? "100%" : undefined,
              border: "2px solid #56a1d2",
              borderRadius: 8,
              overflowY: "auto",
              maxHeight: "80vh",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "#56a1d2",
                color: "#fff",
                textTransform: "uppercase",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "10px 16px",
              }}
            >
              Live Preview — Updates As You Type
            </div>
            <ChapterView
              chapter={{ ...draftValues, code }}
              articles={[]}
              ogMap={{}}
              members={[]}
              previewMode
              contactSlot={<p className="section-subtitle">Contact form appears here</p>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
