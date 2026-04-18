"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { validateTeamMember } from "@/lib/validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Member = {
  id: string; name: string; role: string; chapter_id: string;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_cofounder: boolean; display_order: number;
};
type Chapter = { id: string; name: string; code: string };

const ROLE_OPTIONS = ["Co-Founder", "Chapter Lead", "Host"];

const EMPTY_FORM = {
  name: "", role: "Host", chapter_id: "", description: "",
  profile_image_url: "", linkedin: "", is_cofounder: false, display_order: 0,
};

// Sort priority: Co-Founder=0, Chapter Lead=1, Host=2
function rolePriority(role: string): number {
  if (role === "Founder, Executive Director") return 0;
  if (role.startsWith("Co-Founder")) return 1;
  if (role.includes("Chapter Lead")) return 2;
  return 3;
}

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [filterChapterId, setFilterChapterId] = useState<string>("all");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

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
      if (userRole === "chapter_lead" && userChapterId) {
        setForm((f) => ({ ...f, chapter_id: userChapterId }));
        setFilterChapterId(userChapterId);
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
    setPhotoFile(null);
    setPhotoPreview("");
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
    setPhotoFile(null);
    setPhotoPreview("");
    setError("");
    setShowForm(true);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    const errors = validateTeamMember({ name: form.name, role: form.role });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);
    setError("");
    let photoUrl = form.profile_image_url;

    // If a new photo was selected and we're editing an existing member, upload it first
    if (photoFile && editingId) {
      const fd = new FormData();
      fd.append("file", photoFile);
      const pr = await fetch(`${API_URL}/admin/team/${editingId}/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!pr.ok) {
        setSaving(false);
        setError("Failed to upload photo.");
        return;
      }
      const pd = await pr.json();
      photoUrl = pd.profile_image_url;
    }

    const url = editingId ? `${API_URL}/admin/team/${editingId}` : `${API_URL}/admin/team`;
    const method = editingId ? "PATCH" : "POST";
    const payload = { ...form, profile_image_url: photoUrl, is_cofounder: form.role === "Co-Founder" };
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail ?? "Failed to save.");
      toast.error(body.detail ?? "Failed to save team member");
      return;
    }
    const saved = await r.json();
    if (editingId) {
      setMembers((prev) => prev.map((m) => (m.id === editingId ? saved : m)));
      toast.success("Team member updated");
    } else {
      setMembers((prev) => [...prev, saved]);
      toast.success("Team member added");
    }
    setPhotoFile(null);
    setPhotoPreview("");
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this team member?")) return;
    const r = await fetch(`${API_URL}/admin/team/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("Team member removed");
    } else {
      toast.error("Failed to remove team member");
    }
  }

  if (status === "loading") return null;

  const availableChapters =
    userRole === "chapter_lead"
      ? chapters.filter((c) => c.id === userChapterId)
      : chapters;

  let visibleMembers = members;
  if (filterChapterId !== "all") {
    visibleMembers = visibleMembers.filter((m) => m.chapter_id === filterChapterId);
  } else {
    // De-duplicate co-founders by name across chapters — keep only one entry per name
    const seenCofounderNames = new Set<string>();
    visibleMembers = visibleMembers.filter((m) => {
      if (!m.is_cofounder) return true;
      if (seenCofounderNames.has(m.name)) return false;
      seenCofounderNames.add(m.name);
      return true;
    });
  }

  // Sort: Co-Founders first, then by chapter name, within chapter: Chapter Lead > Host, then alphabetically
  visibleMembers = [...visibleMembers].sort((a, b) => {
    const aCofounder = a.role === "Co-Founder" ? 0 : 1;
    const bCofounder = b.role === "Co-Founder" ? 0 : 1;
    if (aCofounder !== bCofounder) return aCofounder - bCofounder;
    // Both cofounders or both non-cofounders
    if (aCofounder === 0) return a.name.localeCompare(b.name); // cofounders: alphabetical
    // Non-cofounders: sort by chapter, then role priority, then name
    const chapterCmp = chapterName(a.chapter_id).localeCompare(chapterName(b.chapter_id));
    if (chapterCmp !== 0) return chapterCmp;
    const roleCmp = rolePriority(a.role) - rolePriority(b.role);
    if (roleCmp !== 0) return roleCmp;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Team</h1>
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
          {/* Photo preview row */}
          {editingId && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", overflow: "hidden",
                border: "3px solid #d2b356", background: "#f8f6ec", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(photoPreview || form.profile_image_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview || (form.profile_image_url.startsWith("/uploads/") ? `${API_URL}${form.profile_image_url}` : form.profile_image_url)}
                    alt="Profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <i className="fa fa-user" style={{ fontSize: 28, color: "#d2b356" }} aria-hidden="true" />
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Profile Photo</label>
                <label style={{
                  display: "inline-block", padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  border: "1.5px solid #56a1d2", borderRadius: 6, color: "#56a1d2", cursor: "pointer",
                }}>
                  <i className="fa fa-upload" style={{ marginRight: 6 }} aria-hidden="true" />
                  {photoFile ? photoFile.name : "Upload new photo"}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: "none" }} />
                </label>
                {photoFile && (
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                    style={{ marginLeft: 8, fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>
                Name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 14,
                  border: `1.5px solid ${formErrors.name ? "#dc2626" : "#d1d5db"}`,
                  borderRadius: 6,
                  boxSizing: "border-box",
                }}
              />
              {formErrors.name && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>{formErrors.name}</p>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>
                Role <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 14,
                  border: `1.5px solid ${formErrors.role ? "#dc2626" : "#d1d5db"}`,
                  borderRadius: 6,
                  background: "#fff",
                }}
              >
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {formErrors.role && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>{formErrors.role}</p>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Image URL</label>
              <input
                value={form.profile_image_url}
                onChange={(e) => setForm((f) => ({ ...f, profile_image_url: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>LinkedIn URL</label>
              <input
                value={form.linkedin}
                onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>
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

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filterChapterId}
          onChange={(e) => setFilterChapterId(e.target.value)}
          disabled={userRole === "chapter_lead"}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            border: "1.5px solid #d1d5db",
            borderRadius: 6,
            background: "#fff",
            color: "#444",
          }}
        >
          {userRole !== "chapter_lead" && <option value="all">All Chapters</option>}
          {availableChapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <span style={{ fontSize: 13, color: "#9ca3af", marginLeft: "auto" }}>
          {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""}
        </span>
      </div>

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
                {["Name", "Role", "Chapter", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < visibleMembers.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>{m.name}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                      background: m.role === "Co-Founder" ? "#fef9c3" : m.role === "Chapter Lead" ? "#eff6ff" : "#f0fdf4",
                      color: m.role === "Co-Founder" ? "#a16207" : m.role === "Chapter Lead" ? "#56a1d2" : "#16a34a",
                    }}>
                      {m.role}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#d2b356", textTransform: "uppercase", letterSpacing: 1 }}>
                      {chapterName(m.chapter_id)}
                    </span>
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
