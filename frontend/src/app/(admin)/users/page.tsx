"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { validateUser } from "@/lib/validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type UserData = {
  id: string; email: string; username: string | null; role: string;
  name: string | null; title: string | null; chapter_id: string | null; is_active: boolean;
  linkedin: string | null; description: string | null; is_founder: boolean;
  last_login_at: string | null; login_count_30d: number;
  has_api_key: boolean; has_uploaded: boolean; has_article: boolean;
  has_read_hosting_guide: boolean; has_read_lead_guide: boolean;
};
type Chapter = { id: string; name: string; code: string };

const EMPTY_FORM = {
  email: "", username: "", password: "", role: "chapter_lead", chapter_id: "",
  name: "", title: "", linkedin: "", description: "",
};
// Founder + "email them a set-password link" live beside the text fields.
const EMPTY_FLAGS = { is_founder: false, send_link: true };

// Superadmin edit row: every account field except password (own control) and
// the Team-page fields (founder, order, public, photo).
type EditTextKey = "name" | "email" | "username" | "title" | "linkedin";
const EDIT_TEXT_FIELDS: { key: EditTextKey; label: string; placeholder?: string; type?: string }[] = [
  { key: "name", label: "Name", placeholder: "Full name" },
  { key: "email", label: "Email", type: "email" },
  { key: "username", label: "Username", placeholder: "optional" },
  { key: "title", label: "Title", placeholder: "e.g. SF Chapter Lead" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
];
const EMPTY_EDIT = {
  name: "", email: "", username: "", title: "", linkedin: "", description: "",
  role: "host", chapter_id: "", is_founder: false,
};
const editLabelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#6b7280",
};
const editInputStyle: React.CSSProperties = {
  padding: "6px 10px", fontSize: 13, border: "1.5px solid #d1d5db", borderRadius: 5,
  background: "#fff", width: "100%", boxSizing: "border-box", fontWeight: 400, color: "#111",
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [createFlags, setCreateFlags] = useState({ ...EMPTY_FLAGS });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT });
  const [editSaving, setEditSaving] = useState(false);

  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && userRole !== "superadmin") router.replace("/dashboard");
  }, [status, userRole, router]);

  useEffect(() => {
    if (!token || userRole !== "superadmin") return;
    Promise.all([
      fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([usersRes, chaptersRes]) => {
      if (usersRes.status === 401 || chaptersRes.status === 401) {
        signOut({ redirectTo: "/login" });
        return;
      }
      if (!usersRes.ok || !chaptersRes.ok) {
        setError("Failed to load users. Please try again.");
        return;
      }
      const u = await usersRes.json();
      const c = await chaptersRes.json();
      setUsers(Array.isArray(u) ? u : []);
      setChapters(Array.isArray(c) ? c : []);
      setForm((f) => ({ ...f, chapter_id: c[0]?.id ?? "" }));
    });
  }, [token, userRole]);

  function chapterName(id: string | null) {
    if (!id) return "—";
    return chapters.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }

  async function handleCreate() {
    const errors = validateUser({
      email: form.email, password: form.password, role: form.role, sendLink: createFlags.send_link,
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);
    setError("");
    const r = await fetch(`${API_URL}/admin/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        username: form.username || null,
        chapter_id: form.chapter_id || null,
        password: form.password || null,
        is_founder: createFlags.is_founder,
        send_password_link: createFlags.send_link,
      }),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const detail = typeof body.detail === "string" ? body.detail : "Failed to create user.";
      setError(detail);
      toast.error(detail);
      return;
    }
    const created = await r.json();
    setUsers((prev) => [...prev, created]);
    setShowForm(false);
    setForm({ ...EMPTY_FORM, chapter_id: chapters[0]?.id ?? "" });
    setCreateFlags({ ...EMPTY_FLAGS });
    toast.success(createFlags.send_link ? `User created — set-password link emailed to ${created.email}` : "User created");
  }

  async function handleEmailResetLink(user: UserData) {
    const r = await fetch(`${API_URL}/admin/users/${user.id}/password-reset-link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      toast.success(`Set-password link emailed to ${user.email}`);
      setResetUserId(null);
      setResetPassword("");
    } else {
      const body = await r.json().catch(() => ({}));
      toast.error(typeof body.detail === "string" ? body.detail : "Couldn't send the link");
    }
  }

  async function handleDelete(user: UserData) {
    if (!confirm(`Permanently delete user "${user.email}"? This cannot be undone.`)) return;
    const r = await fetch(`${API_URL}/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted");
    } else {
      toast.error("Failed to delete user");
    }
  }

  async function handleResetPassword(userId: string) {
    if (!resetPassword.trim()) return;
    setResetSaving(true);
    const r = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    setResetSaving(false);
    if (r.ok) {
      toast.success("Password updated");
      setResetUserId(null);
      setResetPassword("");
    } else {
      toast.error("Failed to update password");
    }
  }

  function openEdit(user: UserData) {
    setEditUserId(editUserId === user.id ? null : user.id);
    setEditForm({
      name: user.name ?? "", email: user.email, username: user.username ?? "",
      title: user.title ?? "", linkedin: user.linkedin ?? "", description: user.description ?? "",
      role: user.role, chapter_id: user.chapter_id ?? "", is_founder: !!user.is_founder,
    });
    setResetUserId(null);
  }

  async function handleEditSave(userId: string) {
    if (!editForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setEditSaving(true);
    // Blank optional text fields are sent as "" and cleared server-side.
    const r = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(), email: editForm.email.trim(), username: editForm.username.trim(),
        title: editForm.title.trim(), linkedin: editForm.linkedin.trim(), description: editForm.description.trim(),
        role: editForm.role, chapter_id: editForm.chapter_id || null, is_founder: editForm.is_founder,
      }),
    });
    setEditSaving(false);
    if (r.ok) {
      const updated = await r.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setEditUserId(null);
      toast.success("User updated");
    } else {
      const body = await r.json().catch(() => ({}));
      toast.error(typeof body.detail === "string" ? body.detail : "Failed to update user");
    }
  }

  async function toggleActive(user: UserData) {
    const r = await fetch(`${API_URL}/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    if (r.ok) {
      const updated = await r.json();
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast.success(updated.is_active ? "User activated" : "User deactivated");
    } else {
      toast.error("Failed to update user");
    }
  }

  if (status === "loading" || userRole !== "superadmin") return null;

  return (
    <div style={{ padding: "40px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Users</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); }}
          style={{ fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 6, background: "#56a1d2", color: "#fff", border: "none", cursor: "pointer" }}
        >
          <i className="fa fa-plus" style={{ marginRight: 6 }} />
          Add User
        </button>
      </div>

      {error && !showForm && (
        <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</p>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "24px", boxShadow: "0 2px 16px rgba(0,0,0,0.10)", marginBottom: 24, border: "1.5px solid #56a1d2" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>New User</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "email", label: "Email", type: "email", required: true },
              { key: "name", label: "Name", type: "text", required: false },
              { key: "username", label: "Username (optional)", type: "text", required: false },
              { key: "title", label: "Title", type: "text", required: false },
              { key: "linkedin", label: "LinkedIn", type: "url", required: false },
              {
                key: "password",
                label: createFlags.send_link ? "Password (optional — they'll choose their own)" : "Password",
                type: "password",
                required: !createFlags.send_link,
              },
            ].map(({ key, label, type, required }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>
                  {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
                </label>
                <input
                  type={type}
                  aria-label={label}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 14,
                    border: `1.5px solid ${formErrors[key] ? "#dc2626" : "#d1d5db"}`,
                    borderRadius: 6,
                    boxSizing: "border-box",
                  }}
                />
                {formErrors[key] && (
                  <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>{formErrors[key]}</p>
                )}
              </div>
            ))}
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
                <option value="host">Host</option>
                <option value="chapter_lead">Chapter Lead</option>
                <option value="superadmin">Superadmin</option>
              </select>
              {formErrors.role && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>{formErrors.role}</p>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Chapter</label>
              <select
                value={form.chapter_id}
                onChange={(e) => setForm((f) => ({ ...f, chapter_id: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                <option value="">None</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Bio</label>
              <textarea
                aria-label="Bio"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Shown on the public team section"
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111" }}>
              <input
                type="checkbox"
                checked={createFlags.is_founder}
                onChange={(e) => setCreateFlags((f) => ({ ...f, is_founder: e.target.checked }))}
              />
              Founder
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111" }}>
              <input
                type="checkbox"
                checked={createFlags.send_link}
                onChange={(e) => setCreateFlags((f) => ({ ...f, send_link: e.target.checked }))}
              />
              Email them a link to set their password
            </label>
          </div>
          {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 10 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={handleCreate} disabled={saving} style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#56a1d2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {saving ? "Creating…" : "Create User"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: "9px 16px", fontSize: 13, background: "transparent", border: "1.5px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#696969" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
              {["Name", "Email", "Username", "Title", "Role", "Chapter", "Status", "Onboarding", "Last Login", "Logins (30d)", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <>
                <tr key={u.id} style={{ borderBottom: resetUserId === u.id || editUserId === u.id ? "none" : i < users.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111" }}>{u.name ?? "—"}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>{u.email}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>{u.username ?? "—"}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>{u.title ?? "—"}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, textTransform: "capitalize",
                      background: u.role === "superadmin" ? "#fef9c3" : u.role === "host" ? "#f0fdf4" : "#eff6ff",
                      color: u.role === "superadmin" ? "#a16207" : u.role === "host" ? "#16a34a" : "#56a1d2",
                    }}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#d2b356", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    {chapterName(u.chapter_id)}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                      background: u.is_active ? "#dcfce7" : "#f3f4f6",
                      color: u.is_active ? "#16a34a" : "#9ca3af",
                    }}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[
                        { done: u.has_uploaded, icon: "fa-upload", tip: "Uploaded a conversation" },
                        { done: u.has_article, icon: "fa-file-text-o", tip: "Article generated" },
                        ...(u.role !== "superadmin" ? [{ done: u.has_read_hosting_guide, icon: "fa-book", tip: "Read the Hosting Guide" }] : []),
                        ...(u.role === "chapter_lead" ? [{ done: u.has_read_lead_guide, icon: "fa-map-o", tip: "Read the Chapter Lead Guide" }] : []),
                      ].map(({ done, icon, tip }) => (
                        <span
                          key={icon}
                          title={tip}
                          style={{
                            width: 24, height: 24, borderRadius: "50%", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            background: done ? "#dcfce7" : "#f3f4f6",
                            color: done ? "#16a34a" : "#9ca3af",
                            fontSize: 10,
                          }}
                        >
                          <i className={`fa ${icon}`} aria-hidden="true" />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "#111", fontWeight: 600 }}>
                    {u.login_count_30d}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openEdit(u)}
                      title="Edit account"
                      aria-label={`Edit ${u.email}`}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "transparent",
                        border: `1.5px solid ${editUserId === u.id ? "#56a1d2" : "#d1d5db"}`,
                        color: editUserId === u.id ? "#56a1d2" : "#6b7280",
                        marginRight: 6,
                      }}
                    >
                      <i className="fa fa-pencil" />
                    </button>
                    <button
                      onClick={() => { setResetUserId(resetUserId === u.id ? null : u.id); setResetPassword(""); setEditUserId(null); }}
                      title="Reset password"
                      aria-label={`Reset password for ${u.email}`}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "transparent",
                        border: `1.5px solid ${resetUserId === u.id ? "#56a1d2" : "#d1d5db"}`,
                        color: resetUserId === u.id ? "#56a1d2" : "#6b7280",
                        marginRight: 6,
                      }}
                    >
                      <i className="fa fa-key" />
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "transparent",
                        border: `1.5px solid ${u.is_active ? "#fca5a5" : "#86efac"}`,
                        color: u.is_active ? "#ef4444" : "#16a34a",
                        marginRight: 6,
                      }}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      title="Delete user"
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "transparent",
                        border: "1.5px solid #fca5a5",
                        color: "#ef4444",
                      }}
                    >
                      <i className="fa fa-trash-o" />
                    </button>
                  </td>
                </tr>
                {editUserId === u.id && (
                  <tr key={`${u.id}-edit`} style={{ borderBottom: i < users.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                    <td colSpan={11} style={{ padding: "0 20px 16px", background: "#f8f6ec" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "12px 0 10px" }}>
                        Edit {u.email}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        {EDIT_TEXT_FIELDS.map(({ key, label, placeholder, type }) => (
                          <label key={key} style={editLabelStyle}>
                            {label}
                            <input
                              type={type ?? "text"}
                              aria-label={`${label} for ${u.email}`}
                              value={editForm[key]}
                              onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                              placeholder={placeholder}
                              style={editInputStyle}
                            />
                          </label>
                        ))}
                        <label style={editLabelStyle}>
                          Role
                          <select
                            aria-label={`Role for ${u.email}`}
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                            style={editInputStyle}
                          >
                            <option value="host">Host</option>
                            <option value="chapter_lead">Chapter Lead</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        </label>
                        <label style={editLabelStyle}>
                          Chapter
                          <select
                            aria-label={`Chapter for ${u.email}`}
                            value={editForm.chapter_id}
                            onChange={(e) => setEditForm((f) => ({ ...f, chapter_id: e.target.value }))}
                            style={editInputStyle}
                          >
                            <option value="">None</option>
                            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </label>
                        <label style={{ ...editLabelStyle, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "end", paddingBottom: 6 }}>
                          <input
                            type="checkbox"
                            aria-label={`Founder for ${u.email}`}
                            checked={editForm.is_founder}
                            onChange={(e) => setEditForm((f) => ({ ...f, is_founder: e.target.checked }))}
                          />
                          Founder
                        </label>
                        <label style={{ ...editLabelStyle, gridColumn: "1 / -1" }}>
                          Bio
                          <textarea
                            aria-label={`Bio for ${u.email}`}
                            rows={2}
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Shown on the public team section"
                            style={{ ...editInputStyle, resize: "vertical", fontFamily: "inherit" }}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => handleEditSave(u.id)}
                          disabled={editSaving}
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "#56a1d2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditUserId(null)}
                          style={{ padding: "6px 10px", fontSize: 12, background: "transparent", border: "1.5px solid #d1d5db", borderRadius: 5, cursor: "pointer", color: "#696969" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {resetUserId === u.id && (
                  <tr key={`${u.id}-reset`} style={{ borderBottom: i < users.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                    <td colSpan={11} style={{ padding: "0 20px 14px", background: "#f8f6ec" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>New password for {u.email}:</span>
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="Enter new password"
                          style={{ padding: "6px 10px", fontSize: 13, border: "1.5px solid #d1d5db", borderRadius: 5, width: 220 }}
                        />
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          disabled={resetSaving || !resetPassword.trim()}
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "#56a1d2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}
                        >
                          {resetSaving ? "Saving…" : "Save"}
                        </button>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>or</span>
                        <button
                          onClick={() => handleEmailResetLink(u)}
                          aria-label={`Email reset link to ${u.email}`}
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "transparent", border: "1.5px solid #56a1d2", borderRadius: 5, cursor: "pointer", color: "#56a1d2" }}
                        >
                          <i className="fa fa-envelope-o" style={{ marginRight: 6 }} aria-hidden="true" />
                          Email reset link
                        </button>
                        <button
                          onClick={() => { setResetUserId(null); setResetPassword(""); }}
                          style={{ padding: "6px 10px", fontSize: 12, background: "transparent", border: "1.5px solid #d1d5db", borderRadius: 5, cursor: "pointer", color: "#696969" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
