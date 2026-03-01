import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getChapters(token: string) {
  const r = await fetch(`${API_URL}/chapters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  return r.json();
}

export default async function ChaptersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const userRole = (session.user as any)?.role;
  const userChapterId = (session.user as any)?.chapterId;
  const chapters = await getChapters(token);

  const visibleChapters =
    userRole === "chapter_lead"
      ? chapters.filter((c: any) => c.id === userChapterId)
      : chapters;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Chapters</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {visibleChapters.length} chapter{visibleChapters.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {visibleChapters.map((ch: any) => (
          <Link key={ch.id} href={`/chapters/${ch.code}`} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "20px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderLeft: "4px solid #d2b356",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#d2b356" }}>
                  {ch.code}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: ch.status === "active" ? "#dcfce7" : "#f3f4f6",
                    color: ch.status === "active" ? "#16a34a" : "#6b7280",
                  }}
                >
                  {ch.status}
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{ch.name}</h3>
              <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>{ch.tagline}</p>
              <div style={{ marginTop: 14, fontSize: 12, color: "#56a1d2", fontWeight: 600 }}>
                Edit →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
