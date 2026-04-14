"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { toast } from "@/lib/toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "preview" | "edit" | "transcript";

interface Article {
  id: string;
  title: string;
  content_md: string;
  anonymized_transcript?: string | null;
  substack_url?: string | null;
  status: "draft" | "scheduled" | "published";
  chapter_id: string;
  job_id?: string | null;
  created_at: string;
}

// ── Speaker-coloured transcript viewer ────────────────────────────────────────

const SPEAKER_PALETTE = [
  { bg: "#eef6fd", border: "#56a1d2", label: "#2d7ab0" }, // blue
  { bg: "#fdf8ee", border: "#d2b356", label: "#a07a20" }, // gold
];

function TranscriptViewer({ text }: { text: string }) {
  type Block = { speaker: string; body: string };
  const SPEAKER_RE = /^(Speaker [A-Z]|SPEAKER_\d+):\s*/;

  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(SPEAKER_RE);
    if (m) {
      blocks.push({ speaker: m[1], body: line.slice(m[0].length) });
    } else if (blocks.length > 0 && line.trim()) {
      blocks[blocks.length - 1].body += " " + line.trim();
    }
  }

  // Fallback: no recognised speaker labels → plain pre
  if (blocks.length === 0) {
    return (
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.8, color: "#333" }}>
        {text}
      </pre>
    );
  }

  const speakerOrder: string[] = [];
  for (const b of blocks) {
    if (!speakerOrder.includes(b.speaker)) speakerOrder.push(b.speaker);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {blocks.map((block, i) => {
        const { bg, border, label } =
          SPEAKER_PALETTE[speakerOrder.indexOf(block.speaker) % SPEAKER_PALETTE.length];
        return (
          <div
            key={i}
            style={{
              background: bg,
              borderLeft: `3px solid ${border}`,
              borderRadius: "0 8px 8px 0",
              padding: "9px 16px",
            }}
          >
            <span style={{ fontWeight: 700, color: label, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 10 }}>
              {block.speaker}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.75, color: "#333" }}>
              {block.body}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Prose styles applied to the markdown preview ──────────────────────────────
const proseStyles = `
  .prose { color: #222; line-height: 1.75; font-size: 15px; }
  .prose h1 { font-size: 1.75rem; font-weight: 800; margin: 1.5rem 0 0.75rem; color: #111; line-height: 1.2; }
  .prose h2 { font-size: 1.35rem; font-weight: 700; margin: 1.75rem 0 0.6rem; color: #111; line-height: 1.25; border-bottom: 1px solid #f0ebe0; padding-bottom: 0.4rem; }
  .prose h3 { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: #222; }
  .prose h4 { font-size: 0.95rem; font-weight: 700; margin: 1.25rem 0 0.4rem; color: #333; text-transform: uppercase; letter-spacing: 0.05em; }
  .prose p { margin: 0 0 1.1rem; }
  .prose ul, .prose ol { margin: 0 0 1.1rem; padding-left: 1.5rem; }
  .prose li { margin-bottom: 0.4rem; }
  .prose li p { margin: 0; }
  .prose blockquote { border-left: 3px solid #d2b356; margin: 1.25rem 0; padding: 0.5rem 1rem; background: #fdf9f0; color: #555; font-style: italic; border-radius: 0 6px 6px 0; }
  .prose code { background: #f3f0e8; padding: 2px 5px; border-radius: 4px; font-size: 0.875em; font-family: 'SF Mono', 'Fira Code', monospace; }
  .prose pre { background: #1e1e2e; color: #cdd6f4; padding: 1.25rem 1.5rem; border-radius: 8px; overflow-x: auto; margin: 1.25rem 0; }
  .prose pre code { background: none; padding: 0; font-size: 0.85em; color: inherit; }
  .prose a { color: #56a1d2; text-decoration: none; }
  .prose a:hover { text-decoration: underline; }
  .prose hr { border: none; border-top: 1px solid #e8e4d8; margin: 2rem 0; }
  .prose strong { font-weight: 700; color: #111; }
  .prose em { font-style: italic; }
  .prose table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 14px; }
  .prose th { background: #f8f6ec; padding: 8px 12px; text-align: left; font-weight: 700; border: 1px solid #e8e4d8; }
  .prose td { padding: 8px 12px; border: 1px solid #e8e4d8; }
  .prose tr:nth-child(even) td { background: #fdf9f0; }
`;

export default function ArticleEditor({
  article: initial,
  token,
  substackPublicationUrl,
  role,
}: {
  article: Article;
  token: string;
  substackPublicationUrl?: string | null;
  role?: string;
}) {
  const searchParams = useSearchParams();
  const initialTab: Tab =
    searchParams.get("tab") === "transcript" && !!initial.anonymized_transcript
      ? "transcript"
      : "preview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [title, setTitle] = useState(initial.title);
  const [titleError, setTitleError] = useState("");
  const [content, setContent] = useState(initial.content_md ?? "");
  const [substackUrl, setSubstackUrl] = useState(initial.substack_url ?? "");
  const [articleStatus, setArticleStatus] = useState<"draft" | "scheduled" | "published">(initial.status);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"Save" | "Saved ✓" | "Error">("Save");
  const [copyLabel, setCopyLabel] = useState("Copy for Substack");
  const [publishLabel, setPublishLabel] = useState("Publish to Substack");
  const [publishingArticle, setPublishingArticle] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    async () => {
      if (!title.trim()) {
        setTitleError("Title is required");
        return;
      }
      setTitleError("");
      setSaving(true);
      try {
        const r = await fetch(`${API_URL}/admin/articles/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title, content_md: content, substack_url: substackUrl }),
        });
        if (r.ok) {
          toast.success("Article saved");
          setSaveLabel("Saved ✓");
        } else {
          toast.error("Failed to save article");
          setSaveLabel("Error");
        }
      } catch {
        toast.error("Failed to save article");
        setSaveLabel("Error");
      }
      setSaving(false);
      setTimeout(() => setSaveLabel("Save"), 2200);
    },
    [initial.id, token, title, content, substackUrl]
  );

  const publishArticle = useCallback(async () => {
    setPublishingArticle(true);
    try {
      const r = await fetch(`${API_URL}/admin/articles/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "published" }),
      });
      if (r.ok) {
        setArticleStatus("published");
        toast.success("Article marked as done");
      } else {
        toast.error("Failed to update article status");
      }
    } catch {
      toast.error("Failed to update article status");
    }
    setPublishingArticle(false);
  }, [initial.id, token]);

  const copyForSubstack = useCallback(async () => {
    const previewDiv = previewRef.current;
    if (!previewDiv) return;

    const htmlContent = previewDiv.innerHTML;
    const fullHtml = `<h1>${title}</h1>\n${htmlContent}`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([fullHtml], { type: "text/html" }),
          "text/plain": new Blob([`# ${title}\n\n${content}`], { type: "text/plain" }),
        }),
      ]);
      setCopyLabel("Copied ✓");
    } catch {
      // Fallback: copy markdown
      await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
      setCopyLabel("Copied (markdown)");
    }
    setTimeout(() => setCopyLabel("Copy for Substack"), 2500);
  }, [title, content]);

  const publishToSubstack = useCallback(async () => {
    // Copy rich HTML to clipboard then open Substack editor
    const previewDiv = previewRef.current;
    if (previewDiv) {
      const fullHtml = `<h1>${title}</h1>\n${previewDiv.innerHTML}`;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([fullHtml], { type: "text/html" }),
            "text/plain": new Blob([`# ${title}\n\n${content}`], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
      }
    }
    const base = substackPublicationUrl?.replace(/\/$/, "") ?? "https://substack.com";
    window.open(`${base}/publish/post?type=newsletter`, "_blank");
    setPublishLabel("Copied & opened ✓");
    setTimeout(() => setPublishLabel("Publish to Substack"), 3000);
  }, [title, content, substackPublicationUrl]);

  const hasTranscript = !!initial.anonymized_transcript;

  return (
    <>
      {/* Inject prose styles */}
      <style>{proseStyles}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 28px" }}>
        {/* ── Back + status bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Link
            href="/articles"
            style={{
              fontSize: 13,
              color: "#56a1d2",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
            }}
          >
            <i className="fa fa-arrow-left" /> All articles
          </Link>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Publish (mark as done) — only for drafts */}
            {articleStatus === "draft" && (
              <button
                onClick={publishArticle}
                disabled={publishingArticle}
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#d2b356",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: publishingArticle ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <i className="fa fa-check" />
                {publishingArticle ? "Marking…" : "Mark as Done"}
              </button>
            )}

            {/* Publish to Substack — superadmin only */}
            {role === "superadmin" && substackPublicationUrl && (
              <button
                onClick={publishToSubstack}
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: publishLabel.includes("✓") ? "#dcfce7" : "#eef6fd",
                  color: publishLabel.includes("✓") ? "#16a34a" : "#56a1d2",
                  border: "1.5px solid",
                  borderColor: publishLabel.includes("✓") ? "#86efac" : "#56a1d2",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <i className="fa fa-external-link" />
                {publishLabel}
              </button>
            )}

            {/* Save */}
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "7px 16px",
                fontSize: 13,
                fontWeight: 700,
                background:
                  saveLabel === "Saved ✓" ? "#dcfce7"
                  : saveLabel === "Error" ? "#fee2e2"
                  : "#56a1d2",
                color:
                  saveLabel === "Saved ✓" ? "#16a34a"
                  : saveLabel === "Error" ? "#dc2626"
                  : "#fff",
                border: "none",
                borderRadius: 6,
                cursor: saving ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {saving ? "Saving…" : saveLabel}
            </button>
          </div>
        </div>

        {articleStatus === "draft" && (
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", margin: "-16px 0 18px" }}>
            Marks this article as finished. To share externally, publish to Substack using the button above.
          </p>
        )}

        {/* ── Title ── */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError && e.target.value.trim()) setTitleError("");
          }}
          style={{
            width: "100%",
            fontSize: 28,
            fontWeight: 800,
            color: "#111",
            border: "none",
            outline: "none",
            background: "transparent",
            marginBottom: 6,
            padding: 0,
            fontFamily: "inherit",
            letterSpacing: "-0.02em",
          }}
          placeholder="Article title…"
        />
        {titleError && (
          <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px" }}>{titleError}</p>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 22,
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          <span
            style={{
              padding: "2px 9px",
              borderRadius: 12,
              background: articleStatus === "published" ? "#dcfce7" : "#f3f4f6",
              color: articleStatus === "published" ? "#16a34a" : "#6b7280",
              fontWeight: 600,
              fontSize: 11,
              textTransform: "capitalize",
            }}
          >
            {articleStatus}
          </span>
          <span>
            {new Date(initial.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        {/* ── Substack URL ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "12px 16px",
            background: substackUrl ? "#f0f9f4" : "#fafaf8",
            border: `1.5px solid ${substackUrl ? "#86efac" : "#e8e4d8"}`,
            borderRadius: 8,
          }}
        >
          <i className="fa fa-external-link" style={{ color: substackUrl ? "#16a34a" : "#9ca3af", fontSize: 13, flexShrink: 0 }} />
          <input
            value={substackUrl}
            onChange={(e) => setSubstackUrl(e.target.value)}
            placeholder="After publishing on Substack, paste the URL here to enable social sharing"
            style={{
              flex: 1,
              fontSize: 13,
              color: "#222",
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {substackUrl && (
            <a
              href={substackUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}
            >
              View ↗
            </a>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid #f0ebe0",
            marginBottom: 20,
          }}
        >
          {(
            [
              { id: "preview" as Tab, label: "Preview", icon: "fa-eye" },
              { id: "edit" as Tab, label: "Edit", icon: "fa-pencil" },
              ...(hasTranscript
                ? [{ id: "transcript" as Tab, label: "Transcript", icon: "fa-file-text-o" }]
                : []),
            ] as { id: Tab; label: string; icon: string }[]
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                borderBottom: tab === id ? "2px solid #56a1d2" : "2px solid transparent",
                marginBottom: -2,
                background: "transparent",
                color: tab === id ? "#56a1d2" : "#696969",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                transition: "color 0.15s",
              }}
            >
              <i className={`fa ${icon}`} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Preview panel ── */}
        {tab === "preview" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "36px 44px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid #f0ebe0",
            }}
          >
            <div className="prose" ref={previewRef}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ── Edit panel ── */}
        {tab === "edit" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {content.length.toLocaleString()} characters · {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </span>
              <button
                onClick={() => setTab("preview")}
                style={{
                  fontSize: 12,
                  color: "#56a1d2",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i className="fa fa-eye" /> Preview changes
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 560,
                padding: "20px 22px",
                fontSize: 14,
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                lineHeight: 1.7,
                color: "#222",
                background: "#fafaf8",
                border: "1.5px solid #e8e4d8",
                borderRadius: 10,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#56a1d2")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e4d8")}
            />
          </div>
        )}

        {/* ── Transcript panel ── */}
        {tab === "transcript" && initial.anonymized_transcript && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div>
                <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                  Names and identifiers have been replaced with anonymous labels (Person A, Person B…).
                </p>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(initial.anonymized_transcript!);
                  setCopyLabel("Transcript Copied ✓");
                  setTimeout(() => setCopyLabel("Copy for Substack"), 2000);
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#f8f6ec",
                  border: "1px solid #d2b356",
                  color: "#d2b356",
                  borderRadius: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                Copy transcript
              </button>
            </div>
            <div
              style={{
                background: "#fafaf8",
                border: "1.5px solid #e8e4d8",
                borderRadius: 10,
                padding: "18px 22px",
                overflowY: "auto",
                maxHeight: 640,
              }}
            >
              <TranscriptViewer text={initial.anonymized_transcript} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
