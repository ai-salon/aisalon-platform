import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getSubmissions(token: string) {
  const r = await fetch(`${API_URL}/admin/hosting-interest`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  return r.json();
}

const INTEREST_LABELS: Record<string, string> = {
  start_chapter: "Start a Chapter",
  host_existing: "Host (Existing)",
};

export default async function HostingInterestPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const submissions = await getSubmissions(token);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Host Interest</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {submissions.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "60px 24px",
            textAlign: "center",
            color: "#696969",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <i className="fa fa-inbox" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No submissions yet.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["Name", "Email", "City", "Interest", "Chapter", "Date"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 20px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "#9ca3af",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any, i: number) => (
                <tr key={s.id} style={{ borderBottom: i < submissions.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>{s.name}</td>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#56a1d2" }}>
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>{s.city}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: s.interest_type === "start_chapter" ? "#eff6ff" : "#fef9c3",
                        color: s.interest_type === "start_chapter" ? "#1d4ed8" : "#a16207",
                      }}
                    >
                      {INTEREST_LABELS[s.interest_type] ?? s.interest_type}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
                    {s.existing_chapter ?? "—"}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
