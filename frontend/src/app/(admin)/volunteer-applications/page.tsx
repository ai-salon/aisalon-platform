"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fef9c3", color: "#a16207" },
  reviewed: { bg: "#dbeafe", color: "#1d4ed8" },
  accepted: { bg: "#dcfce7", color: "#16a34a" },
  rejected: { bg: "#fef2f2", color: "#dc2626" },
};

type Application = {
  id: string;
  role_id: string;
  role_title: string;
  name: string;
  email: string;
  city: string;
  linkedin_url: string | null;
  why_interested: string;
  relevant_experience: string;
  availability: string;
  how_heard: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: "1 / -1" } : {}}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#9ca3af", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function ApplicationRow({
  app, token, onUpdate,
}: {
  app: Application; token: string; onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.admin_notes ?? "");
  const [saving, setSaving] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    await fetch(`${API_URL}/admin/volunteer-applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus, admin_notes: notes || null }),
    });
    setSaving(false);
    onUpdate();
  };

  const style = STATUS_STYLES[app.status] ?? STATUS_STYLES.pending;

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f8f6ec", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>
          <i className={`fa fa-chevron-${expanded ? "down" : "right"}`} style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }} />
          {app.name}
        </td>
        <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>{app.role_title}</td>
        <td style={{ padding: "14px 20px", fontSize: 14, color: "#56a1d2" }}>
          <a href={`mailto:${app.email}`} onClick={e => e.stopPropagation()}>{app.email}</a>
        </td>
        <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>{app.city}</td>
        <td style={{ padding: "14px 20px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12, background: style.bg, color: style.color }}>
            {app.status}
          </span>
        </td>
        <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
          {new Date(app.created_at).toLocaleDateString()}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: "#fafaf8" }}>
          <td colSpan={6} style={{ padding: "16px 28px 20px 48px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px", marginBottom: 16 }}>
              <Detail label="Why interested" value={app.why_interested} wide />
              <Detail label="Relevant experience" value={app.relevant_experience} wide />
              <Detail label="Availability" value={app.availability} />
              {app.linkedin_url && <Detail label="LinkedIn" value={app.linkedin_url} />}
              {app.how_heard && <Detail label="How heard" value={app.how_heard} />}
              {app.reviewed_at && <Detail label="Reviewed at" value={new Date(app.reviewed_at).toLocaleString()} />}
            </div>

            {/* Admin actions */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "#696969", marginBottom: 4, display: "block" }}>
                  Admin Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes about this applicant..."
                  onClick={e => e.stopPropagation()}
                  style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #e1e1e1", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {app.status !== "accepted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus("accepted"); }}
                    disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Accept
                  </button>
                )}
                {app.status !== "reviewed" && app.status !== "accepted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus("reviewed"); }}
                    disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Mark Reviewed
                  </button>
                )}
                {app.status !== "rejected" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus("rejected"); }}
                    disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function VolunteerApplicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const token = (session as any)?.accessToken as string;

  const fetchApps = () => {
    if (!token) return;
    const params = filterStatus ? `?app_status=${filterStatus}` : "";
    fetch(`${API_URL}/admin/volunteer-applications${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setApplications)
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") fetchApps();
  }, [status, session, router, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ padding: 40, color: "#696969" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Volunteer Applications</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {applications.length} application{applications.length !== 1 ? "s" : ""} — click a row to expand
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "pending", "reviewed", "accepted", "rejected"].map((s) => {
            const label = s || "All";
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 16,
                  border: `1.5px solid ${active ? "#56a1d2" : "#e1e1e1"}`,
                  background: active ? "#eff6ff" : "#fff",
                  color: active ? "#1d4ed8" : "#696969",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {applications.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: "60px 24px", textAlign: "center", color: "#696969", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <i className="fa fa-inbox" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {filterStatus ? `No ${filterStatus} applications.` : "No applications yet."}
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["Name", "Role", "Email", "City", "Status", "Date"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <ApplicationRow key={app.id} app={app} token={token} onUpdate={fetchApps} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
