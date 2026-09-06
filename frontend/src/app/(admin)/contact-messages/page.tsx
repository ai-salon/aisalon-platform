"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ContactMessage = {
  id: string;
  chapter_id: string;
  chapter_name: string | null;
  name: string | null;
  email: string;
  message: string;
  status: "new" | "handled";
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
};

const MESSAGE_PREVIEW_LENGTH = 90;

function MessageRow({
  m,
  token,
  showChapter,
  onUpdate,
}: {
  m: ContactMessage;
  token: string;
  showChapter: boolean;
  onUpdate: (updated: ContactMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = m.status === "new";
  const isTruncated = m.message.length > MESSAGE_PREVIEW_LENGTH;

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = isNew ? "handled" : "new";
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/contact-messages/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          typeof body.detail === "string" ? body.detail : "Failed to update contact message"
        );
        return;
      }
      const updated = await res.json();
      onUpdate(updated);
      toast.success(nextStatus === "handled" ? "Marked handled" : "Marked new");
    } catch {
      toast.error("Failed to update contact message");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid #f8f6ec", cursor: isTruncated ? "pointer" : "default" }}
        onClick={() => isTruncated && setExpanded((v) => !v)}
      >
        <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969", whiteSpace: "nowrap" }}>
          {new Date(m.created_at).toLocaleDateString()}
        </td>
        <td style={{ padding: "14px 20px", fontSize: 14 }}>
          <div style={{ fontWeight: 600, color: "#111" }}>{m.name ?? "—"}</div>
          <a
            href={`mailto:${m.email}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 13, color: "#56a1d2" }}
          >
            {m.email}
          </a>
        </td>
        <td style={{ padding: "14px 20px", fontSize: 14, color: "#374151", maxWidth: 420 }}>
          {isTruncated && (
            <i
              className={`fa fa-chevron-${expanded ? "down" : "right"}`}
              style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}
            />
          )}
          {expanded || !isTruncated ? m.message : `${m.message.slice(0, MESSAGE_PREVIEW_LENGTH)}…`}
        </td>
        {showChapter && (
          <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
            {m.chapter_name ?? "—"}
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
            {m.status}
          </span>
        </td>
        <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
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
    </>
  );
}

export default function ContactMessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
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
    fetch(`${API_URL}/admin/contact-messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMessages)
      .catch(() => {
        toast.error("Failed to load contact messages");
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [status, session, router, token]);

  const handleUpdate = (updated: ContactMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  if (loading) return <div style={{ padding: 40, color: "#696969" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Contact Messages</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>

      {messages.length === 0 ? (
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
          <p style={{ fontSize: 14, margin: 0 }}>No contact messages yet.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {[
                  "Date",
                  "From",
                  "Message",
                  ...(isSuperadmin ? ["Chapter"] : []),
                  "Status",
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
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} token={token} showChapter={isSuperadmin} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
