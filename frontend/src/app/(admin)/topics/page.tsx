"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
}

const mdComponents: any = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 style={{ fontSize: 15, fontWeight: 700, margin: "16px 0 8px" }}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 style={{ fontSize: 14, fontWeight: 700, margin: "12px 0 6px" }}>{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ marginBottom: 4, listStyleType: "disc" }}>{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ marginBottom: 10 }}>{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong style={{ fontWeight: 700 }}>{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2", textDecoration: "underline" }}>
      {children}
    </a>
  ),
};

export default function AdminTopicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);

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
    setContent("");
    setIsActive(true);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(topic: Topic) {
    setTitle(topic.title);
    setContent(topic.content);
    setIsActive(topic.is_active);
    setEditingId(topic.id);
    setShowForm(true);
    setExpandedId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = { title, content, is_active: isActive };
    const url = editingId ? `${API}/admin/topics/${editingId}` : `${API}/admin/topics`;
    const method = editingId ? "PUT" : "POST";
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        resetForm();
        fetchTopics();
      }
    } catch {}
    setSaving(false);
  }

  async function toggleActive(topic: Topic) {
    await fetch(`${API}/admin/topics/${topic.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: topic.title, content: topic.content, is_active: !topic.is_active }),
    });
    fetchTopics();
  }

  if (status === "loading" || loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          <i className="fa fa-lightbulb-o" style={{ marginRight: 10, color: "#d2b356" }} />
          Topics
        </h1>
        {isSuperadmin && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className="fa fa-plus" /> Add Topic
          </button>
        )}
      </div>

      {showForm && isSuperadmin && (
        <div style={{ background: "white", borderRadius: 8, padding: 24, marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? "Edit Topic" : "New Topic"}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 16, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Content (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={16}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                placeholder={"## Description\n\nA brief description of the topic.\n\n**Conversation Topics**\n\n- Topic 1\n- Topic 2\n\n**Evocative Questions**\n\n- Question 1?\n- Question 2?"}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={resetForm} className="btn" style={{ background: "#eee" }}>
                Cancel
              </button>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topics.map((topic) => (
            <div
              key={topic.id}
              style={{
                background: "white",
                borderRadius: 8,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                overflow: "hidden",
                opacity: topic.is_active ? 1 : 0.65,
              }}
            >
              <div
                onClick={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{topic.title}</span>
                  {!topic.is_active && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#fee2e2", color: "#dc2626" }}>
                      Inactive
                    </span>
                  )}
                </div>
                <i
                  className={`fa ${expandedId === topic.id ? "fa-chevron-down" : "fa-chevron-right"}`}
                  style={{ color: "#999", fontSize: 14, flexShrink: 0, marginLeft: 12 }}
                />
              </div>

              {expandedId === topic.id && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                  <div style={{ paddingTop: 16, fontSize: 14, color: "#444", lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {topic.content}
                    </ReactMarkdown>
                  </div>
                  {isSuperadmin && (
                    <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(topic); }}
                        style={{ fontSize: 13, color: "#56a1d2", background: "none", border: "1px solid #56a1d2", borderRadius: 5, padding: "5px 14px", cursor: "pointer" }}
                      >
                        <i className="fa fa-pencil" style={{ marginRight: 5 }} />Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleActive(topic); }}
                        style={{
                          fontSize: 13,
                          color: topic.is_active ? "#dc2626" : "#16a34a",
                          background: "none",
                          border: `1px solid ${topic.is_active ? "#dc2626" : "#16a34a"}`,
                          borderRadius: 5,
                          padding: "5px 14px",
                          cursor: "pointer",
                        }}
                      >
                        {topic.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
