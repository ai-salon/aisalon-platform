"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type VolunteerRole = {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  time_commitment: string | null;
  chapter_id: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
  is_active: boolean;
  display_order: number;
  application_count: number;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #e1e1e1",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#696969",
  marginBottom: 4,
};

export default function VolunteerRolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hideInactive, setHideInactive] = useState(true);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRequirements, setFormRequirements] = useState("");
  const [formTimeCommitment, setFormTimeCommitment] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const token = (session as any)?.accessToken as string;

  const fetchRoles = () => {
    if (!token) return;
    fetch(`${API_URL}/admin/volunteer-roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoles)
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") fetchRoles();
  }, [status, session, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormTitle(""); setFormSlug(""); setFormDescription("");
    setFormRequirements(""); setFormTimeCommitment(""); setFormDisplayOrder(0);
    setShowCreate(false); setEditingId(null);
  };

  const startEdit = (role: VolunteerRole) => {
    setFormTitle(role.title);
    setFormSlug(role.slug);
    setFormDescription(role.description);
    setFormRequirements(role.requirements ?? "");
    setFormTimeCommitment(role.time_commitment ?? "");
    setFormDisplayOrder(role.display_order);
    setEditingId(role.id);
    setShowCreate(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      title: formTitle,
      slug: formSlug,
      description: formDescription,
      requirements: formRequirements || null,
      time_commitment: formTimeCommitment || null,
      display_order: formDisplayOrder,
    };

    const url = editingId
      ? `${API_URL}/admin/volunteer-roles/${editingId}`
      : `${API_URL}/admin/volunteer-roles`;

    await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSaving(false);
    resetForm();
    fetchRoles();
  };

  const toggleActive = async (role: VolunteerRole) => {
    if (!role.is_active) {
      await fetch(`${API_URL}/admin/volunteer-roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: true }),
      });
    } else {
      await fetch(`${API_URL}/admin/volunteer-roles/${role.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    fetchRoles();
  };

  const visibleRoles = hideInactive ? roles.filter((r) => r.is_active) : roles;
  const inactiveCount = roles.filter((r) => !r.is_active).length;

  if (loading) return <div style={{ padding: 40, color: "#696969" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Volunteer Roles</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {visibleRoles.length} role{visibleRoles.length !== 1 ? "s" : ""} shown
            {hideInactive && inactiveCount > 0 && (
              <span style={{ marginLeft: 6 }}>
                · <button
                    onClick={() => setHideInactive(false)}
                    style={{ background: "none", border: "none", padding: 0, color: "#56a1d2", cursor: "pointer", fontSize: 14, fontWeight: 400 }}
                  >
                    {inactiveCount} inactive hidden
                  </button>
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#696969", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={hideInactive}
              onChange={(e) => setHideInactive(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Hide inactive
          </label>
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="btn-primary"
            style={{ fontSize: 13, padding: "8px 20px" }}
          >
            <i className="fa fa-plus" style={{ marginRight: 6 }} /> Add Role
          </button>
        </div>
      </div>

      {/* Create/Edit form */}
      {showCreate && (
        <form
          onSubmit={handleSave}
          style={{ background: "#fff", borderRadius: 8, padding: "28px 32px", marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 20 }}>
            {editingId ? "Edit Role" : "New Role"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Title *</label>
              <input required value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Chapter Lead" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Slug *</label>
              <input required value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="chapter-lead" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Time Commitment</label>
              <input value={formTimeCommitment} onChange={e => setFormTimeCommitment(e.target.value)} placeholder="4-6 hours/month" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Display Order</label>
              <input type="number" value={formDisplayOrder} onChange={e => setFormDisplayOrder(parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description *</label>
            <textarea required value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={5} placeholder="Role description (supports markdown)..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Requirements</label>
            <textarea value={formRequirements} onChange={e => setFormRequirements(e.target.value)} rows={3} placeholder="- Requirement 1\n- Requirement 2..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: "8px 24px" }}>
              {saving ? "Saving..." : editingId ? "Update Role" : "Create Role"}
            </button>
            <button type="button" onClick={resetForm} className="btn-outline" style={{ fontSize: 13, padding: "8px 24px" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Roles table */}
      {visibleRoles.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: "60px 24px", textAlign: "center", color: "#696969", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <i className="fa fa-briefcase" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {roles.length === 0 ? "No roles yet. Create your first volunteer role." : "All roles are inactive."}
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
                {["Role", "Location", "Time", "Applications", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoles.map((role) => (
                <tr key={role.id} style={{ borderBottom: "1px solid #f8f6ec" }}>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{role.title}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>/{role.slug}</div>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
                      color: "#fff",
                      background: role.chapter_code ? "#d2b356" : "#9ca3af",
                      padding: "2px 7px", borderRadius: 4,
                    }}>
                      {role.chapter_name ?? "Global"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#696969" }}>
                    {role.time_commitment ?? "—"}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: role.application_count > 0 ? "#56a1d2" : "#9ca3af" }}>
                      {role.application_count}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12,
                      background: role.is_active ? "#dcfce7" : "#f3f4f6",
                      color: role.is_active ? "#16a34a" : "#9ca3af",
                    }}>
                      {role.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <button
                      onClick={() => startEdit(role)}
                      style={{ background: "none", border: "none", color: "#56a1d2", cursor: "pointer", fontSize: 13, fontWeight: 600, marginRight: 12 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(role)}
                      style={{ background: "none", border: "none", color: role.is_active ? "#dc2626" : "#16a34a", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      {role.is_active ? "Deactivate" : "Activate"}
                    </button>
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
