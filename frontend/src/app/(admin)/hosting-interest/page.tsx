"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INTEREST_LABELS: Record<string, string> = {
  start_chapter: "Start a Chapter",
  host_existing: "Host (Existing)",
};

const FREQUENCY_LABELS: Record<string, string> = {
  more_than_monthly: "More than monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

type HostingInterest = {
  id: string;
  name: string;
  email: string;
  city: string;
  interest_type: "start_chapter" | "host_existing";
  existing_chapter: string | null;
  message: string | null;
  salons_attended?: string | null;
  facilitated_before?: string | null;
  themes_interested?: string | null;
  why_hosting?: string | null;
  hosting_frequency?: string | null;
  space_options?: string | null;
  status: "new" | "handled";
  handled_by: string | null;
  handled_at: string | null;
  chapter_id: string | null;
  created_at: string;
};

function SubmissionRow({
  s,
  index,
  total,
  token,
  showChapter,
  onUpdate,
}: {
  s: HostingInterest;
  index: number;
  total: number;
  token: string;
  showChapter: boolean;
  onUpdate: (updated: HostingInterest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = s.status === "new";
  const columnCount = 7 + (showChapter ? 1 : 0);

  async function toggleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const nextStatus = isNew ? "handled" : "new";
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/hosting-interest/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          typeof body.detail === "string" ? body.detail : "Failed to update submission"
        );
        return;
      }
      const updated = await res.json();
      onUpdate(updated);
      toast.success(nextStatus === "handled" ? "Marked handled" : "Marked new");
    } catch {
      toast.error("Failed to update submission");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid #f8f6ec", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>
          <i className={`fa fa-chevron-${expanded ? "down" : "right"}`} style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }} />
          {s.name}
        </td>
        <td style={{ padding: "14px 20px", fontSize: 14, color: "#56a1d2" }}>
          <a href={`mailto:${s.email}`} onClick={e => e.stopPropagation()}>{s.email}</a>
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
        {showChapter && (
          <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
            {s.existing_chapter ?? "—"}
          </td>
        )}
        <td style={{ padding: "14px 20px" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 12,
              background: isNew ? "#fdf8ee" : "#f3f4f6",
              color: isNew ? "#a07a20" : "#6b7280",
            }}
          >
            {s.status}
          </span>
        </td>
        <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
          {new Date(s.created_at).toLocaleDateString()}
        </td>
        <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={toggleStatus}
            disabled={saving}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1.5px solid #e1e1e1",
              background: "#fff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {isNew ? "Mark handled" : "Mark new"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: index < total - 1 ? "1px solid #f0f0f0" : "none", background: "#fafaf8" }}>
          <td colSpan={columnCount} style={{ padding: "16px 28px 20px 48px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
              {s.salons_attended && (
                <Detail label="Salons attended" value={s.salons_attended} />
              )}
              {s.facilitated_before && (
                <Detail label="Facilitated before" value={s.facilitated_before} />
              )}
              {s.themes_interested && (
                <Detail label="Themes interested in" value={s.themes_interested} wide />
              )}
              {s.why_hosting && (
                <Detail label="Why hosting" value={s.why_hosting} wide />
              )}
              {s.hosting_frequency && (
                <Detail label="Hosting frequency" value={FREQUENCY_LABELS[s.hosting_frequency] ?? s.hosting_frequency} />
              )}
              {s.space_options && (
                <Detail label="Space available" value={s.space_options} wide />
              )}
              {s.message && (
                <Detail label="Additional notes" value={s.message} wide />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: "1 / -1" } : {}}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#9ca3af", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

export default function HostingInterestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<HostingInterest[]>([]);
  const [loading, setLoading] = useState(true);

  const token = (session as unknown as { accessToken?: string })?.accessToken as string;
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isSuperadmin = userRole === "superadmin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;
    fetch(`${API_URL}/admin/hosting-interest`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubmissions)
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, [status, session, router, token]);

  const handleUpdate = (updated: HostingInterest) => {
    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  if (loading) return <div style={{ padding: 40, color: "#696969" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Host Interest</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""} — click a row to expand details
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
                {[
                  "Name",
                  "Email",
                  "City",
                  "Interest",
                  ...(isSuperadmin ? ["Chapter"] : []),
                  "Status",
                  "Date",
                  "",
                ].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
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
              {submissions.map((s, i) => (
                <SubmissionRow
                  key={s.id}
                  s={s}
                  index={i}
                  total={submissions.length}
                  token={token}
                  showChapter={isSuperadmin}
                  onUpdate={handleUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
