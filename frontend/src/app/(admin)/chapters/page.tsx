"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUSES = ["draft", "active", "archived", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];
type ChapterStatus = "draft" | "active" | "archived";

type Chapter = {
  id: string;
  code: string;
  name: string;
  tagline?: string;
  status: ChapterStatus;
};

export default function ChaptersAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const token = (session as any)?.accessToken as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;
  const userChapterId = (session?.user as any)?.chapterId as string | undefined;

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace("/login");
  }, [sessionStatus, router]);

  async function refresh() {
    if (!token) return;
    // Superadmins see all (incl. draft/archived) via /admin/chapters.
    // Chapter leads see only their own chapter via the public /chapters list.
    const path = userRole === "superadmin" ? "/admin/chapters" : "/chapters";
    const r = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.ok) {
      const data: Chapter[] = await r.json();
      const visible =
        userRole === "chapter_lead" && userChapterId
          ? data.filter((c) => c.id === userChapterId)
          : data;
      setChapters(visible);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (token) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userRole, userChapterId]);

  const filtered = useMemo(() => {
    if (filter === "all") return chapters;
    return chapters.filter((c) => c.status === filter);
  }, [chapters, filter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9-]+$/.test(newCode)) {
      setError("Code must be lowercase letters, numbers, and hyphens only.");
      return;
    }
    setCreating(true);
    const r = await fetch(`${API_URL}/admin/chapters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    setCreating(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail || "Failed to create chapter.");
      return;
    }
    setShowCreate(false);
    setNewCode("");
    setNewName("");
    refresh();
  }

  async function setStatus(code: string, newStatus: ChapterStatus) {
    await fetch(`${API_URL}/admin/chapters/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status: newStatus }),
    });
    refresh();
  }

  if (sessionStatus === "loading" || !loaded) return null;

  const isSuperadmin = userRole === "superadmin";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>
            Chapters
          </h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {filtered.length} chapter{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              background: "#56a1d2",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            New chapter
          </button>
        )}
      </div>

      {isSuperadmin && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {STATUSES.map((s) => {
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: active ? "#56a1d2" : "#f3f4f6",
                  color: active ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: 16,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((ch) => (
          <div
            key={ch.id}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "20px 24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              borderLeft: "4px solid #d2b356",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#d2b356",
                }}
              >
                {ch.code}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background:
                    ch.status === "active"
                      ? "#dcfce7"
                      : ch.status === "archived"
                      ? "#fee2e2"
                      : "#f3f4f6",
                  color:
                    ch.status === "active"
                      ? "#16a34a"
                      : ch.status === "archived"
                      ? "#b91c1c"
                      : "#6b7280",
                }}
              >
                {ch.status}
              </span>
            </div>
            <Link
              href={`/chapters/edit/${ch.code}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111",
                  margin: "0 0 4px",
                }}
              >
                {ch.name}
              </h3>
              {ch.tagline && (
                <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>{ch.tagline}</p>
              )}
            </Link>
            {isSuperadmin && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <select
                  value={ch.status}
                  onChange={(e) => setStatus(ch.code, e.target.value as ChapterStatus)}
                  style={{
                    border: "1.5px solid #d1d5db",
                    borderRadius: 6,
                    padding: "5px 8px",
                    fontSize: 13,
                    background: "#fff",
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {ch.status !== "archived" && (
                    <Link
                      href={`/users?chapter=${ch.code}&invite=1`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#56a1d2",
                        textDecoration: "none",
                      }}
                    >
                      + Add person
                    </Link>
                  )}
                  <Link
                    href={`/chapters/edit/${ch.code}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#56a1d2",
                      textDecoration: "none",
                    }}
                  >
                    Edit →
                  </Link>
                </div>
              </div>
            )}
            {!isSuperadmin && (
              <Link
                href={`/chapters/edit/${ch.code}`}
                style={{
                  fontSize: 12,
                  color: "#56a1d2",
                  fontWeight: 600,
                  textDecoration: "none",
                  marginTop: 6,
                }}
              >
                Edit →
              </Link>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <form
            onSubmit={onCreate}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              width: "100%",
              maxWidth: 420,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New chapter</h2>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Code (lowercase, hyphens)
              </span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toLowerCase())}
                required
                maxLength={32}
                style={{
                  padding: "10px 13px",
                  fontSize: 14,
                  border: "1.5px solid #d1d5db",
                  borderRadius: 6,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Name
              </span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={128}
                style={{
                  padding: "10px 13px",
                  fontSize: 14,
                  border: "1.5px solid #d1d5db",
                  borderRadius: 6,
                }}
              />
            </label>
            {error && (
              <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>
            )}
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setError(null);
                }}
                style={{
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: creating ? "#d1d5db" : "#56a1d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: creating ? "default" : "pointer",
                }}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
