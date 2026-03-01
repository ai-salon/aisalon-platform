import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef9c3", color: "#a16207" },
  processing: { bg: "#dbeafe", color: "#1d4ed8" },
  completed:  { bg: "#dcfce7", color: "#16a34a" },
  failed:     { bg: "#fee2e2", color: "#dc2626" },
};

async function getJobs(token: string) {
  const r = await fetch(`${API_URL}/admin/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  return r.json();
}

async function getArticles(token: string) {
  const r = await fetch(`${API_URL}/admin/articles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  return r.json();
}

export default async function JobsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const [jobs, articles] = await Promise.all([getJobs(token), getArticles(token)]);

  // Map job_id → article id for "View Article" links
  const articleByJob: Record<string, string> = {};
  for (const a of articles) {
    if (a.job_id) articleByJob[a.job_id] = a.id;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Jobs</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/upload"
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 6,
            background: "#56a1d2",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          <i className="fa fa-upload" style={{ marginRight: 6 }} />
          New Upload
        </Link>
      </div>

      {jobs.length === 0 ? (
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
          <p style={{ fontSize: 14, margin: 0 }}>No jobs yet. Upload a recording to get started.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["File", "Chapter", "Status", "Created", ""].map((h) => (
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
              {jobs.map((job: any, i: number) => {
                const style = STATUS_STYLES[job.status] ?? STATUS_STYLES.pending;
                const articleId = articleByJob[job.id];
                return (
                  <tr key={job.id} style={{ borderBottom: i < jobs.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                    <td style={{ padding: "14px 20px", fontSize: 14, color: "#111", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <i className="fa fa-file-audio-o" style={{ color: "#56a1d2", marginRight: 8 }} />
                      {job.input_filename ?? "—"}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
                      {job.chapter_id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 12,
                          background: style.bg,
                          color: style.color,
                          textTransform: "capitalize",
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      {articleId && (
                        <Link
                          href={`/articles/${articleId}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#56a1d2",
                            textDecoration: "none",
                            border: "1.5px solid #56a1d2",
                            padding: "4px 10px",
                            borderRadius: 5,
                          }}
                        >
                          View Article
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
