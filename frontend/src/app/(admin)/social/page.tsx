"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Article {
  id: string;
  title: string;
  substack_url: string | null;
  status: string;
  chapter_id: string;
  created_at: string;
}

// ── Template generators ────────────────────────────────────────────────────

function linkedinTemplate(title: string, url: string, chapterName: string): string {
  return `🎙️ New Ai Salon conversation recap: "${title}"

We had a fascinating discussion on AI and its impact on our community. Check out the full writeup from our ${chapterName} chapter.

${url}

#AISalon #AI #Innovation #MachineLearning`;
}

function twitterTemplate(title: string, url: string): string {
  return `New Ai Salon recap: "${title}"

${url}

#AISalon #AI`;
}

function newsletterTemplate(title: string, url: string, chapterName: string): string {
  return `Subject: New Ai Salon Recap — ${title}

Hi everyone,

We just published a new conversation recap from the ${chapterName} chapter:

"${title}"

Read the full recap here: ${url}

See you at the next event!
— Ai Salon`;
}

// ── Article card ───────────────────────────────────────────────────────────

function ArticleCard({ article, chapterName }: { article: Article; chapterName: string }) {
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "newsletter">("linkedin");
  const [copy, setCopy] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [open, setOpen] = useState(false);

  const url = article.substack_url!;

  function generate(p: typeof platform) {
    setPlatform(p);
    if (p === "linkedin") setCopy(linkedinTemplate(article.title, url, chapterName));
    else if (p === "twitter") setCopy(twitterTemplate(article.title, url));
    else setCopy(newsletterTemplate(article.title, url, chapterName));
  }

  function handleOpen() {
    setOpen(true);
    generate("linkedin");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(copy);
    setCopyLabel("Copied ✓");
    setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "18px 22px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Link
            href={`/articles/${article.id}`}
            style={{ fontSize: 15, fontWeight: 700, color: "#111", textDecoration: "none" }}
          >
            {article.title}
          </Link>
          <div style={{ fontSize: 12, color: "#696969", marginTop: 3 }}>
            {chapterName} · {new Date(article.created_at).toLocaleDateString()}
            {" · "}
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2" }}>
              View on Substack ↗
            </a>
          </div>
        </div>
        {!open && (
          <button
            onClick={handleOpen}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 700,
              background: "#f3e8ff",
              color: "#7c3aed",
              border: "1.5px solid #c4b5fd",
              borderRadius: 6,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <i className="fa fa-share-alt" style={{ marginRight: 6 }} />
            Create post
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          {/* Platform tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["linkedin", "twitter", "newsletter"] as const).map((p) => (
              <button
                key={p}
                onClick={() => generate(p)}
                style={{
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "1.5px solid",
                  borderColor: platform === p ? "#7c3aed" : "#e5e7eb",
                  background: platform === p ? "#f3e8ff" : "#fff",
                  color: platform === p ? "#7c3aed" : "#696969",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {p === "twitter" ? "X / Twitter" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <textarea
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            rows={platform === "newsletter" ? 10 : 6}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 13,
              lineHeight: 1.65,
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
              color: "#222",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={handleCopy}
              style={{
                padding: "7px 18px",
                fontSize: 13,
                fontWeight: 700,
                background: copyLabel.includes("✓") ? "#dcfce7" : "#56a1d2",
                color: copyLabel.includes("✓") ? "#16a34a" : "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <i className="fa fa-clipboard" style={{ marginRight: 6 }} />
              {copyLabel}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "7px 14px",
                fontSize: 13,
                background: "transparent",
                border: "1.5px solid #e5e7eb",
                borderRadius: 6,
                cursor: "pointer",
                color: "#696969",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { data: session, status } = useSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [chapters, setChapters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/admin/articles`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_URL}/admin/chapters`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([arts, chs]) => {
      setArticles(arts.filter((a: Article) => a.status === "published" && a.substack_url));
      const map: Record<string, string> = {};
      for (const c of chs) map[c.id] = c.name;
      setChapters(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (status === "loading" || loading) return null;

  const withLink = articles;
  const withoutLink = articles.length === 0 ? [] : [];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Social Media</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 36 }}>
        Create ready-to-post templates for your published articles.
      </p>

      {/* ── Published articles with Substack links ── */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <i className="fa fa-file-text-o" style={{ color: "#56a1d2", fontSize: 15 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>
            Articles
            <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
              ({withLink.length})
            </span>
          </h2>
        </div>

        {withLink.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "28px 24px",
              textAlign: "center",
              border: "1.5px dashed #e5e7eb",
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
              No published articles with Substack links yet.
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
              Publish an article and add its Substack URL to create social posts.
            </p>
          </div>
        ) : (
          withLink.map((a) => (
            <ArticleCard key={a.id} article={a} chapterName={chapters[a.chapter_id] ?? "Ai Salon"} />
          ))
        )}
      </section>

      {/* ── Events placeholder ── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <i className="fa fa-calendar" style={{ color: "#d2b356", fontSize: 15 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>Upcoming Events</h2>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: "28px 24px",
            textAlign: "center",
            border: "1.5px dashed #e5e7eb",
          }}
        >
          <i className="fa fa-calendar-o" style={{ fontSize: 28, color: "#d2b356", marginBottom: 12, display: "block" }} />
          <p style={{ color: "#696969", fontSize: 14, margin: 0, fontWeight: 600 }}>Coming soon — Luma integration</p>
          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
            Once connected, upcoming events will appear here with auto-generated announcement templates.
          </p>
        </div>
      </section>
    </div>
  );
}
