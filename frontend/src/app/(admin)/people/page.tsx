"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import InviteCard from "@/components/InviteCard";

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
  hide_from_team: boolean;
  chapter_code: string | null;
  chapter_name: string | null;
}

const cell: React.CSSProperties = { padding: "14px 20px" };
const inputStyle: React.CSSProperties = {
  padding: "6px 10px", fontSize: 13, border: "1.5px solid #d1d5db", borderRadius: 5,
};
const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: bg, color,
});

function displayName(p: Person) {
  return p.name || p.username || p.email;
}

export default function PeoplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const userRole = (session?.user as unknown as { role?: string } | undefined)?.role;
  const isSuperadmin = userRole === "superadmin";
  const isEditor = isSuperadmin || userRole === "chapter_lead";
  const [people, setPeople] = useState<Person[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [hostingInterest, setHostingInterest] = useState(0);

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

  // Outstanding hosting-interest count, already scoped per role by the API.
  useEffect(() => {
    if (!token || !isEditor) return;
    fetch(`${API_URL}/admin/notifications/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { hosting_interest?: number } | null) =>
        setHostingInterest(Number(d?.hosting_interest ?? 0)),
      )
      .catch(() => {});
  }, [token, isEditor]);

  /** Superadmins edit anyone. Leads edit hosts and co-leads in their chapter
   *  (the list is already chapter-scoped by the API), never superadmins or founders. */
  function canEditRow(p: Person) {
    if (isSuperadmin) return true;
    if (userRole !== "chapter_lead") return false;
    return p.role !== "superadmin" && !p.is_founder;
  }

  async function update(id: string, patch: Partial<Person>) {
    const r = await fetch(`${API_URL}/admin/people/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      toast.error(body?.detail ?? "Couldn't save that change.");
    }
    refresh();
  }

  const headers = [
    "Photo", "Name", "Title", "Role", "Chapter", "Founder",
    ...(isEditor ? ["Order", "Public"] : []),
    "Profile",
  ];

  return (
    <div style={{ padding: "40px 30px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Team</h1>
        <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
          {people.length} member{people.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isEditor && hostingInterest > 0 && (
        <div
          role="status"
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
            background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8,
            padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#713f12",
          }}
        >
          <span>
            <i className="fa fa-star" style={{ marginRight: 8 }} aria-hidden="true" />
            <strong>{hostingInterest} new hosting request{hostingInterest === 1 ? "" : "s"}</strong>
            {isSuperadmin ? "" : " for your chapter"}
            {" "}from people who want to host a salon.
          </span>
          <Link href="/hosting-interest" style={{ fontWeight: 700, color: "#a16207", whiteSpace: "nowrap" }}>
            Review →
          </Link>
        </div>
      )}

      {isEditor && (
        <div style={{ maxWidth: 480, marginBottom: 24 }}>
          <InviteCard />
        </div>
      )}

      {loadError && (
        <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
          Failed to load the team list. Please try again.
        </p>
      )}

      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f8f6ec" }}>
              {headers.map((h) => (
                <th
                  key={h}
                  title={h === "Public" ? "Shown on the aisalon.xyz team section and chapter page" : undefined}
                  style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => {
              const editable = canEditRow(p);
              const name = displayName(p);
              return (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < people.length - 1 ? "1px solid #f8f6ec" : "none",
                    opacity: p.hide_from_team ? 0.6 : 1,
                  }}
                >
                  <td style={cell}>
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
                  <td style={{ ...cell, fontSize: 14, fontWeight: 500, color: "#111" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {name}
                      {p.hide_from_team && <span style={pill("#f3f4f6", "#6b7280")}>Hidden</span>}
                    </span>
                  </td>
                  <td style={cell}>
                    {editable ? (
                      <input
                        type="text"
                        aria-label={`Title for ${name}`}
                        defaultValue={p.title ?? ""}
                        placeholder="e.g. Host"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (p.title ?? "")) update(p.id, { title: v });
                        }}
                        style={{ ...inputStyle, width: 180 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: "#696969" }}>{p.title || "—"}</span>
                    )}
                  </td>
                  <td style={cell}>
                    <span style={{
                      ...pill(
                        p.role === "superadmin" ? "#fef9c3" : p.role === "host" ? "#f0fdf4" : "#eff6ff",
                        p.role === "superadmin" ? "#a16207" : p.role === "host" ? "#16a34a" : "#56a1d2",
                      ),
                      fontWeight: 700, textTransform: "capitalize",
                    }}>
                      {p.role.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ ...cell, fontSize: 13, color: "#d2b356", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    {p.chapter_name || "—"}
                  </td>
                  <td style={cell}>
                    {isSuperadmin ? (
                      <input
                        type="checkbox"
                        aria-label={`Founder: ${name}`}
                        checked={p.is_founder}
                        onChange={(e) => update(p.id, { is_founder: e.target.checked })}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: "#696969" }}>{p.is_founder ? "Yes" : "—"}</span>
                    )}
                  </td>
                  {isEditor && (
                    <td style={cell}>
                      {editable ? (
                        <input
                          type="number"
                          aria-label={`Display order for ${name}`}
                          defaultValue={p.display_order}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== p.display_order) update(p.id, { display_order: v });
                          }}
                          style={{ ...inputStyle, width: 64 }}
                        />
                      ) : (
                        <span style={{ fontSize: 13, color: "#696969" }}>{p.display_order}</span>
                      )}
                    </td>
                  )}
                  {isEditor && (
                    <td style={cell}>
                      {editable ? (
                        <input
                          type="checkbox"
                          aria-label={`Show ${name} publicly`}
                          checked={!p.hide_from_team}
                          onChange={(e) => update(p.id, { hide_from_team: !e.target.checked })}
                        />
                      ) : (
                        <span style={{ fontSize: 13, color: "#696969" }}>{p.hide_from_team ? "No" : "Yes"}</span>
                      )}
                    </td>
                  )}
                  <td style={cell}>
                    <span style={pill(
                      p.profile_completed_at ? "#dcfce7" : "#f3f4f6",
                      p.profile_completed_at ? "#16a34a" : "#9ca3af",
                    )}>
                      {p.profile_completed_at ? "Complete" : "Incomplete"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
