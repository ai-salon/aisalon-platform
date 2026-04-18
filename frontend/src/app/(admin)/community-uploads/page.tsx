"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Upload {
  id: string;
  name: string | null;
  email: string | null;
  topic_id: string | null;
  topic_text: string | null;
  city: string;
  audio_path: string;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e" },
  reviewed: { bg: "#dcfce7", color: "#16a34a" },
  rejected: { bg: "#fee2e2", color: "#dc2626" },
};

export default function AdminCommunityUploadsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (token) fetchUploads();
  }, [token, filter]);

  async function fetchUploads() {
    setLoading(true);
    try {
      const qs = filter ? `?upload_status=${filter}` : "";
      const r = await fetch(`${API}/admin/community-uploads${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setUploads(await r.json());
    } catch {}
    setLoading(false);
  }

  async function updateStatus(uploadId: string, newStatus: string) {
    await fetch(`${API}/admin/community-uploads/${uploadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchUploads();
  }

  if (authStatus === "loading" || loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }

  const filters = ["", "pending", "reviewed", "rejected"];

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        <i className="fa fa-cloud-upload" style={{ marginRight: 10, color: "#56a1d2" }} />
        Community Uploads
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {filters.map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "1px solid #ddd",
              background: filter === f ? "#56a1d2" : "white",
              color: filter === f ? "white" : "#555",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {uploads.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <i className="fa fa-inbox" style={{ fontSize: 48, marginBottom: 12, display: "block" }} />
          <p>{filter ? `No ${filter} uploads.` : "No community uploads yet."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {uploads.map((u) => {
            const s = STATUS_STYLES[u.status] || STATUS_STYLES.pending;
            return (
              <div key={u.id} style={{ background: "white", borderRadius: 8, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{u.name || "Anonymous"}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>
                      {u.email || "No email"} &middot; {u.city} &middot; {new Date(u.created_at).toLocaleDateString()}
                    </div>
                    {(u.topic_text || u.topic_id) && (
                      <div style={{ fontSize: 13, color: "#56a1d2", marginTop: 4 }}>
                        Topic: {u.topic_text || u.topic_id}
                      </div>
                    )}
                    {u.notes && <div style={{ marginTop: 8, fontSize: 14, color: "#555", lineHeight: 1.5 }}>{u.notes}</div>}
                  </div>
                  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
                    {u.status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
                  {u.status !== "reviewed" && (
                    <button onClick={() => updateStatus(u.id, "reviewed")} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #16a34a", background: "white", color: "#16a34a", cursor: "pointer" }}>
                      Mark Reviewed
                    </button>
                  )}
                  {u.status !== "rejected" && (
                    <button onClick={() => updateStatus(u.id, "rejected")} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #dc2626", background: "white", color: "#dc2626", cursor: "pointer" }}>
                      Reject
                    </button>
                  )}
                  {u.status !== "pending" && (
                    <button onClick={() => updateStatus(u.id, "pending")} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #888", background: "white", color: "#888", cursor: "pointer" }}>
                      Reset to Pending
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
