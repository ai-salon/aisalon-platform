import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getChapters(token: string) {
  const res = await fetch(`${API_URL}/chapters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

async function getTeam(token: string, chapterCode?: string) {
  const url = chapterCode
    ? `${API_URL}/team?chapter=${chapterCode}`
    : `${API_URL}/team`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const userRole = (session.user as any)?.role;
  const userChapterId = (session.user as any)?.chapterId;

  const chapters = await getChapters(token);

  // For chapter leads, find their chapter code
  let focusChapterCode: string | undefined;
  if (userRole === "chapter_lead" && userChapterId) {
    const ch = chapters.find((c: any) => c.id === userChapterId);
    focusChapterCode = ch?.code;
  }

  const team = await getTeam(token, focusChapterCode);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 30px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 15, color: "#696969", marginTop: 6 }}>
          Welcome back, {session.user?.email} &nbsp;·&nbsp;
          <span style={{ color: "#d2b356", fontWeight: 600, textTransform: "capitalize" }}>
            {userRole}
          </span>
        </p>
      </div>

      {/* Chapters */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span className="section-label" style={{ margin: 0 }}>Chapters</span>
          <span style={{ fontSize: 13, color: "#999" }}>{chapters.length} total</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {chapters.map((ch: any) => (
            <div
              key={ch.id}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "20px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderLeft: "4px solid #d2b356",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
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
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>{ch.name}</h3>
              <p style={{ fontSize: 13, color: "#696969", marginTop: 4, marginBottom: 0 }}>{ch.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span className="section-label" style={{ margin: 0 }}>
            Team {focusChapterCode ? `· ${focusChapterCode.toUpperCase()}` : "· All Chapters"}
          </span>
          <span style={{ fontSize: 13, color: "#999" }}>{team.length} members</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["Name", "Role", "Chapter", "Co-founder"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 20px",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "#696969",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((m: any, i: number) => (
                <tr
                  key={m.id}
                  style={{ borderBottom: i < team.length - 1 ? "1px solid #f8f6ec" : "none" }}
                >
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>{m.name}</td>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>{m.role}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#d2b356", textTransform: "uppercase", letterSpacing: 1 }}>
                      {chapters.find((c: any) => c.id === m.chapter_id)?.code ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    {m.is_cofounder && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", color: "#56a1d2" }}>
                        Co-founder
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
