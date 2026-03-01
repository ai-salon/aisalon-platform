"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Member = {
  id: string; name: string; role: string; chapter_id: string;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_cofounder: boolean; display_order: number;
};
type Chapter = { id: string; name: string; code: string };

const EMPTY_FORM = {
  name: "", role: "", chapter_id: "", description: "",
  profile_image_url: "", linkedin: "", is_cofounder: false, display_order: 0,
};

export default function TeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;
  const userChapterId = (session?.user as any)?.chapterId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/team`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([m, c]) => {
      setMembers(m);
      setChapters(c);
      // Pre-fill chapter for leads
      if (userRole === "chapter_lead" && userChapterId) {
        setForm((f) => ({ ...f, chapter_id: userChapterId }));
      } else if (c.length > 0) {
        setForm((f) => ({ ...f, chapter_id: c[0].id }));
      }
    });
  }, [token, userRole, userChapterId]);

  function chapterName(id: string) {
    return chapters.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      chapter_id: userRole === "chapter_lead" && userChapterId ? userChapterId : chapters[0]?.id ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function openEdit(m: Member) {
    setEditingId(m.id);
    setForm({
      name: m.name, role: m.role, chapter_id: m.chapter_id,
      description: m.description ?? "", profile_image_url: m.profile_image_url,
      linkedin: m.linkedin ?? "", is_cofounder: m.is_cofounder,
      display_order: m.display_order,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const url = editingId ? `${API_URL}/admin/team/${editingId}` : `${API_URL}/admin/team`;
    const method = editingId ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail ?? "Failed to save.");
      return;
    }
    const saved = await r.json();
    if (editingId) {
      setMembers((prev) => prev.map((m) => (m.id === editingId ? saved : m)));
    } else {
      setMembers((prev) => [...prev, saved]);
    }
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this team member?")) return;
    const r = await fetch(`${API_URL}/admin/team/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  if (status === "loading") return null;

  const visibleMembers =
    userRole === "chapter_lead"
      ? members.filter((m) => m.chapter_id === userChapterId)
      : members;

  const availableChapters =
    userRole === "chapter_lead"
      ? chapters.filter((c) => c.id === userChapterId)
      : chapters;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Team</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 6,
            background: "#56a1d2",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          <i className="fa fa-plus" style={{ marginRight: 6 }} />
          Add Member
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "24px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
            marginBottom: 24,
            border: "1.5px solid #56a1d2",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>
            {editingId ? "Edit Member" : "Add Member"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "profile_image_url", label: "Image URL" },
              { key: "linkedin", label: "LinkedIn URL" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>{label}</label>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Chapter</label>
              <select
                value={form.chapter_id}
                onChange={(e) => setForm((f) => ({ ...f, chapter_id: e.target.value }))}
                disabled={userRole === "chapter_lead"}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                {availableChapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Display Order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="cofounder"
              checked={form.is_cofounder}
              onChange={(e) => setForm((f) => ({ ...f, is_cofounder: e.target.checked }))}
            />
            <label htmlFor="cofounder" style={{ fontSize: 14, color: "#444" }}>Co-founder</label>
          </div>
          {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 10 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#56a1d2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: "9px 16px", fontSize: 13, background: "transparent", border: "1.5px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#696969" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      {visibleMembers.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: "60px 24px", textAlign: "center", color: "#696969", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <i className="fa fa-users" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No team members yet.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["Name", "Role", "Chapter", "Co-founder", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < visibleMembers.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>{m.name}</td>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>{m.role}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#d2b356", textTransform: "uppercase", letterSpacing: 1 }}>
                      {chapterName(m.chapter_id)}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    {m.is_cofounder && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", color: "#56a1d2" }}>
                        Co-founder
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(m)} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: "1.5px solid #56a1d2", color: "#56a1d2", background: "transparent", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(m.id)} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: "1.5px solid #fca5a5", color: "#ef4444", background: "transparent", cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
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
