"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  description: string;
  opening_question: string;
  prompts: string[];
  is_active: boolean;
  display_order: number;
}

export default function AdminTopicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openingQuestion, setOpeningQuestion] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  const token = (session as any)?.accessToken;
  const userRole = (session as any)?.user?.role;
  const isSuperadmin = userRole === "superadmin";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setTopics(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (token) fetchTopics();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setTitle("");
    setDescription("");
    setOpeningQuestion("");
    setPromptsText("");
    setIsActive(true);
    setDisplayOrder(0);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(topic: Topic) {
    setTitle(topic.title);
    setDescription(topic.description);
    setOpeningQuestion(topic.opening_question);
    setPromptsText(topic.prompts.join("\n"));
    setIsActive(topic.is_active);
    setDisplayOrder(topic.display_order);
    setEditingId(topic.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const prompts = promptsText.split("\n").map((p) => p.trim()).filter(Boolean);
    const body = { title, description, opening_question: openingQuestion, prompts, is_active: isActive, display_order: displayOrder };
    const url = editingId ? `${API}/admin/topics/${editingId}` : `${API}/admin/topics`;
    const method = editingId ? "PUT" : "POST";
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (r.ok) { resetForm(); fetchTopics(); }
    } catch {}
    setSaving(false);
  }

  async function toggleActive(topic: Topic) {
    await fetch(`${API}/admin/topics/${topic.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: topic.title, description: topic.description,
        opening_question: topic.opening_question, prompts: topic.prompts,
        is_active: !topic.is_active, display_order: topic.display_order,
      }),
    });
    fetchTopics();
  }

  if (status === "loading" || loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, boxSizing: "border-box" as const };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          <i className="fa fa-lightbulb-o" style={{ marginRight: 10, color: "#d2b356" }} />
          Topics
        </h1>
        {isSuperadmin && !showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="fa fa-plus" /> Add Topic
          </button>
        )}
      </div>

      {showForm && isSuperadmin && (
        <div style={{ background: "white", borderRadius: 8, padding: 24, marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? "Edit Topic" : "New Topic"}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Display Order</label>
                  <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} style={{ ...inputStyle, resize: "vertical" as const }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Opening Question</label>
              <input value={openingQuestion} onChange={(e) => setOpeningQuestion(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Follow-up Prompts (one per line)</label>
              <textarea value={promptsText} onChange={(e) => setPromptsText(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" as const }} placeholder={"What do you think about X?\nHow would you approach Y?"} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving..." : editingId ? "Update" : "Create"}</button>
              <button type="button" onClick={resetForm} className="btn" style={{ background: "#eee" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {topics.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <i className="fa fa-lightbulb-o" style={{ fontSize: 48, marginBottom: 12 }} />
          <p>No topics yet.</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>Topic</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 80 }}>Order</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 100 }}>Status</th>
              {isSuperadmin && <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 160 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{topic.title}</div>
                  <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>
                    {topic.description.substring(0, 120)}{topic.description.length > 120 && "..."}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>{topic.display_order}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: topic.is_active ? "#dcfce7" : "#fee2e2", color: topic.is_active ? "#16a34a" : "#dc2626" }}>
                    {topic.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                {isSuperadmin && (
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEdit(topic)} style={{ fontSize: 13, color: "#56a1d2", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => toggleActive(topic)} style={{ fontSize: 13, color: topic.is_active ? "#dc2626" : "#16a34a", background: "none", border: "none", cursor: "pointer" }}>
                        {topic.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
