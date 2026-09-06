"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Person {
  id: string;
  username: string | null;
  email: string;
  role: string;
  name: string | null;
  title: string | null;
  is_founder: boolean;
  display_order: number;
  profile_image_url: string | null;
  profile_completed_at: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
}

export default function PeoplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const userRole = (session?.user as unknown as { role?: string } | undefined)?.role;
  const canEdit = userRole === "superadmin";
  const [people, setPeople] = useState<Person[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  async function refresh() {
    const r = await fetch(`${API_URL}/admin/people`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (r.status === 401) {
      signOut({ redirectTo: "/login" });
      return;
    }
    if (r.ok) {
      const data = await r.json();
      setPeople(Array.isArray(data) ? data : []);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }

  useEffect(() => {
    if (token) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function update(id: string, patch: Partial<Person>) {
    await fetch(`${API_URL}/admin/people/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  return (
    <div style={{ padding: "40px 30px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Team</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {people.length} member{people.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loadError && (
        <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
          Failed to load the team list. Please try again.
        </p>
      )}

      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
              {["Photo", "Name", "Role", "Chapter", "Founder", ...(canEdit ? ["Order"] : []), "Profile"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < people.length - 1 ? "1px solid #f8f6ec" : "none" }}>
                <td style={{ padding: "14px 20px" }}>
                  {p.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.profile_image_url.startsWith("/uploads/") ? `${API_URL}${p.profile_image_url}` : p.profile_image_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fa fa-user" style={{ color: "#9ca3af", fontSize: 16 }} aria-hidden="true" />
                    </div>
                  )}
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#111" }}>
                  {p.name || p.username || p.email}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, textTransform: "capitalize",
                    background: p.role === "superadmin" ? "#fef9c3" : p.role === "host" ? "#f0fdf4" : "#eff6ff",
                    color: p.role === "superadmin" ? "#a16207" : p.role === "host" ? "#16a34a" : "#56a1d2",
                  }}>
                    {p.role.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#d2b356", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  {p.chapter_name || "—"}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={p.is_founder}
                      onChange={(e) => update(p.id, { is_founder: e.target.checked })}
                    />
                  ) : (
                    <span style={{ fontSize: 13, color: "#696969" }}>{p.is_founder ? "Yes" : "—"}</span>
                  )}
                </td>
                {canEdit && (
                  <td style={{ padding: "14px 20px" }}>
                    <input
                      type="number"
                      defaultValue={p.display_order}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.display_order) update(p.id, { display_order: v });
                      }}
                      style={{ padding: "6px 10px", fontSize: 13, border: "1.5px solid #d1d5db", borderRadius: 5, width: 64 }}
                    />
                  </td>
                )}
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                    background: p.profile_completed_at ? "#dcfce7" : "#f3f4f6",
                    color: p.profile_completed_at ? "#16a34a" : "#9ca3af",
                  }}>
                    {p.profile_completed_at ? "Complete" : "Incomplete"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
