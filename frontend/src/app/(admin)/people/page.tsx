"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import InviteCard from "@/components/InviteCard";
import PhotoCropper from "@/components/PhotoCropper";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

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

interface ChapterOption {
  id: string;
  code: string;
  name: string;
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

function photoSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

function Avatar({ url }: { url: string | null }) {
  const src = photoSrc(url);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className="fa fa-user" style={{ color: "#9ca3af", fontSize: 16 }} aria-hidden="true" />
    </div>
  );
}

/**
 * Team page = presentation of the public team: photo, title, order, public.
 * Account attributes (founder, role, chapter, identity) live on the Users page.
 * Superadmins can preview the page exactly as a given chapter's lead sees it.
 */
export default function PeoplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const sessionRole = (session?.user as unknown as { role?: string } | undefined)?.role;
  const isSuperadmin = sessionRole === "superadmin";
  const [people, setPeople] = useState<Person[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [hostingInterest, setHostingInterest] = useState(0);
  // Superadmin "view as": chapter code being previewed, or "" for the real view.
  const [viewAs, setViewAs] = useState("");
  // Superadmin photo editing: one hidden file input serves every row.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<Person | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ person: Person; file: File } | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);

  const previewing = isSuperadmin && viewAs !== "";
  // The role whose controls we render. While previewing, act like a lead.
  const userRole = previewing ? "chapter_lead" : sessionRole;
  const canUseSuperadminControls = isSuperadmin && !previewing;
  const isEditor = userRole === "superadmin" || userRole === "chapter_lead";
  const previewChapter = chapters.find((c) => c.code === viewAs);
  const visible = previewing ? people.filter((p) => p.chapter_code === viewAs) : people;

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

  // Chapter list for the superadmin "view as" switch.
  useEffect(() => {
    if (!token || !isSuperadmin) return;
    fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((c: ChapterOption[]) => setChapters(Array.isArray(c) ? c : []))
      .catch(() => {});
  }, [token, isSuperadmin]);

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
    if (canUseSuperadminControls) return true;
    if (userRole !== "chapter_lead") return false;
    return p.role !== "superadmin" && !p.is_founder;
  }

  async function update(id: string, patch: Partial<Person>): Promise<boolean> {
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
    return r.ok;
  }

  function pickPhotoFor(p: Person) {
    photoTargetRef.current = p;
    photoInputRef.current?.click();
  }

  function onPhotoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = photoTargetRef.current;
    photoTargetRef.current = null;
    if (!file || !target) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setPendingPhoto({ person: target, file });
  }

  // Same two-step flow as My Profile: upload the cropped image, then point the
  // member's profile at it via the people endpoint (superadmin-only field).
  async function handlePhotoCropped(blob: Blob) {
    const target = pendingPhoto?.person;
    setPendingPhoto(null);
    if (!target) return;
    setUploadingPhotoId(target.id);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const uploadRes = await fetch(`${API_URL}/profile/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!uploadRes.ok) {
        toast.error("Photo upload failed. Try again.");
        return;
      }
      const body = await uploadRes.json();
      if (await update(target.id, { profile_image_url: body.url })) {
        toast.success(`Photo updated for ${displayName(target)}`);
      }
    } finally {
      setUploadingPhotoId(null);
    }
  }

  const headers = [
    "Photo", "Name", "Title", "Role", "Chapter",
    ...(isEditor ? ["Order", "Public"] : []),
    "Profile",
  ];

  return (
    <div style={{ padding: "40px 30px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Team</h1>
          <p style={{ fontSize: 14, color: "#696969", marginTop: 4, marginBottom: 0 }}>
            {visible.length} member{visible.length !== 1 ? "s" : ""}
            {previewChapter ? ` in ${previewChapter.name}` : ""}
          </p>
        </div>
        {isSuperadmin && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#696969" }}>
            View as
            <select
              aria-label="View as chapter"
              value={viewAs}
              onChange={(e) => setViewAs(e.target.value)}
              style={{ ...inputStyle, background: "#fff" }}
            >
              <option value="">Superadmin (all chapters)</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.code}>{c.name} chapter lead</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {previewing && (
        <div
          role="status"
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
            background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
            padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#1e3a8a",
          }}
        >
          <span>
            <i className="fa fa-eye" style={{ marginRight: 8 }} aria-hidden="true" />
            Previewing this page as a <strong>{previewChapter?.name ?? viewAs}</strong> chapter lead would see it.
            Only lead-level controls are shown.
          </span>
          <button
            type="button"
            onClick={() => setViewAs("")}
            style={{ fontWeight: 700, color: "#1d4ed8", background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Exit preview
          </button>
        </div>
      )}

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
            {canUseSuperadminControls ? "" : " for your chapter"}
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
                  title={
                    h === "Public"
                      ? "Shown on the aisalon.xyz team section and chapter page"
                      : h === "Profile"
                        ? "Complete once the account has a name"
                        : undefined
                  }
                  style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const editable = canEditRow(p);
              const name = displayName(p);
              const complete = !!p.name;
              return (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < visible.length - 1 ? "1px solid #f8f6ec" : "none",
                    opacity: p.hide_from_team ? 0.6 : 1,
                  }}
                >
                  <td style={cell}>
                    {canUseSuperadminControls ? (
                      <button
                        type="button"
                        aria-label={`Change photo for ${name}`}
                        title="Change photo"
                        disabled={uploadingPhotoId === p.id}
                        onClick={() => pickPhotoFor(p)}
                        style={{
                          position: "relative", padding: 0, border: "none", background: "transparent",
                          borderRadius: "50%", cursor: uploadingPhotoId === p.id ? "wait" : "pointer",
                          opacity: uploadingPhotoId === p.id ? 0.5 : 1,
                        }}
                      >
                        <Avatar url={p.profile_image_url} />
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: "50%",
                            background: "#56a1d2", color: "#fff", fontSize: 10, display: "flex",
                            alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #fff",
                          }}
                        >
                          <i className="fa fa-camera" />
                        </span>
                      </button>
                    ) : (
                      <Avatar url={p.profile_image_url} />
                    )}
                  </td>
                  <td style={{ ...cell, fontSize: 14, fontWeight: 500, color: "#111" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {name}
                      {p.is_founder && <span style={pill("#fef3c7", "#a16207")}>Founder</span>}
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
                    <span style={pill(complete ? "#dcfce7" : "#f3f4f6", complete ? "#16a34a" : "#9ca3af")}>
                      {complete ? "Complete" : "Incomplete"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canUseSuperadminControls && (
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png"
          aria-label="New photo file"
          onChange={onPhotoFileSelected}
          style={{ display: "none" }}
        />
      )}
      {pendingPhoto && (
        <PhotoCropper
          file={pendingPhoto.file}
          onCancel={() => setPendingPhoto(null)}
          onConfirm={handlePhotoCropped}
        />
      )}
    </div>
  );
}
