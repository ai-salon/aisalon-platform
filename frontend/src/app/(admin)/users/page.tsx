"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type UserData = {
  id: string; email: string; username: string | null; role: string;
  chapter_id: string | null; is_active: boolean;
};
type Chapter = { id: string; name: string; code: string };

const EMPTY_FORM = { email: "", username: "", password: "", role: "chapter_lead", chapter_id: "" };

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && userRole !== "superadmin") router.replace("/dashboard");
  }, [status, userRole, router]);

  useEffect(() => {
    if (!token || userRole !== "superadmin") return;
    Promise.all([
      fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([u, c]) => {
      setUsers(u);
      setChapters(c);
      setForm((f) => ({ ...f, chapter_id: c[0]?.id ?? "" }));
    });
  }, [token, userRole]);

  function chapterName(id: string | null) {
    if (!id) return "—";
    return chapters.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }

  async function handleCreate() {
    setSaving(true);
    setError("");
    const r = await fetch(`${API_URL}/admin/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, username: form.username || null, chapter_id: form.chapter_id || null }),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail ?? "Failed to create user.");
      return;
    }
    const created = await r.json();
    setUsers((prev) => [...prev, created]);
    setShowForm(false);
    setForm({ ...EMPTY_FORM, chapter_id: chapters[0]?.id ?? "" });
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
    }
  }

  if (status === "loading" || userRole !== "superadmin") return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 30px" }}>
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

      {/* Create form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "24px", boxShadow: "0 2px 16px rgba(0,0,0,0.10)", marginBottom: 24, border: "1.5px solid #56a1d2" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>New User</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "email", label: "Email", type: "email" },
              { key: "username", label: "Username (optional)", type: "text" },
              { key: "password", label: "Password", type: "password" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                <option value="host">Host</option>
                <option value="chapter_lead">Chapter Lead</option>
                <option value="superadmin">Superadmin</option>
              </select>
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
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
              {["Email", "Username", "Role", "Chapter", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#111" }}>{u.email}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#696969" }}>{u.username ?? "—"}</td>
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
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  <button
                    onClick={() => toggleActive(u)}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "transparent",
                      border: `1.5px solid ${u.is_active ? "#fca5a5" : "#86efac"}`,
                      color: u.is_active ? "#ef4444" : "#16a34a",
                    }}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
