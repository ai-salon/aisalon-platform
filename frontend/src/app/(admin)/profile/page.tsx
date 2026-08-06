"use client";
// frontend/src/app/(admin)/profile/page.tsx
// Data flow:
//  - on mount: GET /profile/me → { name, title, linkedin, description,
//    scheduling_url, hide_from_team, profile_image_url, email, pending_email }
//  - photo card: reuse the upload pattern from (public)/profile/complete
//    (POST /profile/photo multipart → returns {url}; then PATCH /profile/me
//    with profile_image_url)
//  - info card: local state per field; Save → PATCH /profile/me (only changed
//    keys); toast success/error like settings/page.tsx does
//  - account card:
//      email row: shows current email; "Change…" reveals inline
//        {new_email, current_password} form → POST /profile/email-change;
//        202 → show pending banner; 503 → "Email is not configured" message
//      pending banner (when pending_email set): amber box (bg #f8f6ec,
//        border #d2b356): "Verification sent to {pending_email}" with
//        Resend (re-POST same payload — asks password again) and Cancel
//        (DELETE /profile/email-change) actions
//      password: move the exact form JSX + submit handler from
//        settings/page.tsx (the block calling POST /auth/change-password,
//        including the 12-char and match validations) into this card
// The subtitle under the page title reads:
//   "This is how you appear on aisalon.xyz — the homepage team section and
//    your chapter's page."

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { toast } from "@/lib/toast";
import PhotoCropper from "@/components/PhotoCropper";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

interface Profile {
  id: string;
  name: string | null;
  profile_image_url: string | null;
  linkedin: string | null;
  description: string | null;
  title: string | null;
  is_founder: boolean;
  profile_completed_at: string | null;
  email: string;
  scheduling_url: string | null;
  hide_from_team: boolean;
  pending_email: string | null;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: "24px 28px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 4,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#696969",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 14,
  border: "1.5px solid #d1d5db",
  borderRadius: 6,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const primaryBtnStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "9px 18px",
  borderRadius: 6,
  background: "#56a1d2",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const outlineBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: 6,
  border: "1.5px solid #56a1d2",
  color: "#56a1d2",
  background: "transparent",
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 14px",
  background: "transparent",
  border: "1.5px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
  color: "#696969",
};

function photoSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

// ---------- Photo card ----------
function PhotoCard({
  profile,
  token,
  onSaved,
}: {
  profile: Profile;
  token: string;
  onSaved: (patch: Partial<Profile>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setPendingFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    const uploadRes = await fetch(`${API_URL}/profile/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!uploadRes.ok) {
      setUploading(false);
      toast.error("Photo upload failed. Try again.");
      return;
    }
    const body = await uploadRes.json();
    const patchRes = await fetch(`${API_URL}/profile/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ profile_image_url: body.url }),
    });
    setUploading(false);
    if (!patchRes.ok) {
      toast.error("Photo uploaded, but saving to your profile failed.");
      return;
    }
    onSaved({ profile_image_url: body.url });
    toast.success("Photo updated");
  }

  const src = photoSrc(profile.profile_image_url);

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <i className="fa fa-camera" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Photo</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
        Shown alongside your name on the homepage team section and your chapter&apos;s page.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={profile.name ?? "Profile"}
            style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 12,
            }}
          >
            No photo
          </div>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileSelected}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ ...primaryBtnStyle, cursor: uploading ? "wait" : "pointer" }}
          >
            {uploading ? "Uploading…" : src ? "Change photo" : "Upload photo"}
          </button>
        </div>
      </div>
      {pendingFile && (
        <PhotoCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

// ---------- Public info card ----------
function InfoCard({
  profile,
  token,
  onSaved,
}: {
  profile: Profile;
  token: string;
  onSaved: (patch: Partial<Profile>) => void;
}) {
  const [name, setName] = useState(profile.name ?? "");
  const [title, setTitle] = useState(profile.title ?? "");
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? "");
  const [description, setDescription] = useState(profile.description ?? "");
  const [schedulingUrl, setSchedulingUrl] = useState(profile.scheduling_url ?? "");
  const [hideFromTeam, setHideFromTeam] = useState(profile.hide_from_team);
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== (profile.name ?? "") ||
    title.trim() !== (profile.title ?? "") ||
    linkedin.trim() !== (profile.linkedin ?? "") ||
    description.trim() !== (profile.description ?? "") ||
    schedulingUrl.trim() !== (profile.scheduling_url ?? "") ||
    hideFromTeam !== profile.hide_from_team;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const patch: Record<string, unknown> = {};
    if (name.trim() !== (profile.name ?? "")) patch.name = name.trim();
    if (title.trim() !== (profile.title ?? "")) patch.title = title.trim() || null;
    if (linkedin.trim() !== (profile.linkedin ?? "")) patch.linkedin = linkedin.trim() || null;
    if (description.trim() !== (profile.description ?? "")) patch.description = description.trim() || null;
    if (schedulingUrl.trim() !== (profile.scheduling_url ?? ""))
      patch.scheduling_url = schedulingUrl.trim() || null;
    if (hideFromTeam !== profile.hide_from_team) patch.hide_from_team = hideFromTeam;

    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    const r = await fetch(`${API_URL}/profile/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!r.ok) {
      toast.error("Failed to save profile");
      return;
    }
    onSaved(patch as Partial<Profile>);
    toast.success("Profile saved");
  }

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <i className="fa fa-id-card-o" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Public info</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 20 }}>
        Your name, title, links and bio shown on your public profile.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={fieldLabelStyle}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="e.g. San Francisco Chapter Lead"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>LinkedIn URL</label>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            maxLength={512}
            placeholder="https://linkedin.com/in/you"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Bio ({description.length}/350)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 350))}
            maxLength={350}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>1:1 Scheduling Link</label>
          <input
            type="url"
            value={schedulingUrl}
            onChange={(e) => setSchedulingUrl(e.target.value)}
            maxLength={512}
            placeholder="https://cal.com/yourname/meeting"
            style={inputStyle}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            paddingTop: 12,
            borderTop: "1px solid #f1f1ec",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Hide from team page</div>
            <div style={{ fontSize: 12, color: "#696969", marginTop: 2, lineHeight: 1.5 }}>
              Keeps you off the public homepage and chapter team sections.
            </div>
          </div>
          <button
            onClick={() => setHideFromTeam((v) => !v)}
            aria-pressed={hideFromTeam}
            style={{
              position: "relative",
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: hideFromTeam ? "#56a1d2" : "#d1d5db",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.15s",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: hideFromTeam ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            ...primaryBtnStyle,
            alignSelf: "flex-start",
            opacity: !dirty ? 0.5 : 1,
            cursor: saving ? "wait" : !dirty ? "default" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ---------- Account card ----------
function EmailChangeForm({
  token,
  initialEmail,
  onSuccess,
  onCancel,
}: {
  token: string;
  initialEmail: string;
  onSuccess: (newEmail: string) => void;
  onCancel: () => void;
}) {
  const [newEmail, setNewEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const r = await fetch(`${API_URL}/profile/email-change`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ new_email: newEmail.trim(), current_password: password }),
    });
    setSubmitting(false);
    if (r.status === 202) {
      toast.success(`Verification sent to ${newEmail.trim()}`);
      setPassword("");
      onSuccess(newEmail.trim());
      return;
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 403) {
      toast.error(body.detail ?? "Current password is incorrect");
    } else if (r.status === 409) {
      toast.error(body.detail ?? "That email is already in use");
    } else if (r.status === 400) {
      toast.error(body.detail ?? "That is already your email");
    } else if (r.status === 503) {
      toast.error("Email change is unavailable — email is not configured");
    } else {
      toast.error("Failed to request email change");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="New email address"
        required
        style={inputStyle}
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Current password"
        required
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={submitting || !newEmail.trim() || !password}
          style={{
            ...primaryBtnStyle,
            opacity: submitting || !newEmail.trim() || !password ? 0.6 : 1,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Sending…" : "Send verification"}
        </button>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Moved verbatim (JSX + submit handler) from settings/page.tsx's ChangePasswordSection.
function ChangePasswordForm({ token }: { token: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (next.length < 12) {
      toast.error("New password must be at least 12 characters");
      return;
    }
    setSaving(true);
    const r = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    setSaving(false);
    if (r.status === 204) {
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
      return;
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 400) {
      toast.error(body.detail ?? "Current password is incorrect");
    } else if (r.status === 422) {
      toast.error("New password doesn't meet strength requirements");
    } else {
      toast.error("Failed to update password");
    }
  }

  return (
    <div style={{ paddingTop: 20, marginTop: 20, borderTop: "1px solid #f1f1ec" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <i className="fa fa-lock" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Change Password</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 16 }}>
        At least 12 characters, including upper- and lower-case letters and a number.
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          style={{
            ...primaryBtnStyle,
            alignSelf: "flex-start",
            opacity: !current || !next || !confirm ? 0.5 : 1,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

function AccountCard({
  profile,
  token,
  onSaved,
}: {
  profile: Profile;
  token: string;
  onSaved: (patch: Partial<Profile>) => void;
}) {
  const [changingEmail, setChangingEmail] = useState(false);
  const [resending, setResending] = useState(false);

  async function cancelPendingEmail() {
    const r = await fetch(`${API_URL}/profile/email-change`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      onSaved({ pending_email: null });
      toast.success("Email change canceled");
    } else {
      toast.error("Failed to cancel email change");
    }
  }

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <i className="fa fa-user-circle-o" style={{ color: "#56a1d2", fontSize: 15 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Account</span>
      </div>
      <p style={{ fontSize: 13, color: "#696969", marginBottom: 20 }}>
        Your login credentials. Changing your email requires confirming a link sent to the new
        address.
      </p>

      <div>
        <label style={fieldLabelStyle}>Login email</label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 14, color: "#333" }}>{profile.email}</span>
          {!profile.pending_email && !changingEmail && (
            <button onClick={() => setChangingEmail(true)} style={outlineBtnStyle}>
              Change…
            </button>
          )}
        </div>

        {changingEmail && !profile.pending_email && (
          <EmailChangeForm
            token={token}
            initialEmail=""
            onSuccess={(newEmail) => {
              setChangingEmail(false);
              onSaved({ pending_email: newEmail });
            }}
            onCancel={() => setChangingEmail(false)}
          />
        )}

        {profile.pending_email && !resending && (
          <div
            style={{
              marginTop: 12,
              background: "#f8f6ec",
              border: "1px solid #d2b356",
              borderRadius: 6,
              padding: "12px 14px",
            }}
          >
            <p style={{ fontSize: 13, color: "#333", margin: 0 }}>
              Verification sent to <b>{profile.pending_email}</b>. Check that inbox to confirm the
              change.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setResending(true)} style={outlineBtnStyle}>
                Resend
              </button>
              <button onClick={cancelPendingEmail} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {profile.pending_email && resending && (
          <EmailChangeForm
            token={token}
            initialEmail={profile.pending_email}
            onSuccess={(newEmail) => {
              setResending(false);
              onSaved({ pending_email: newEmail });
            }}
            onCancel={() => setResending(false)}
          />
        )}
      </div>

      <ChangePasswordForm token={token} />
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const token = (session as unknown as { accessToken?: string })?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
  }, [status]);

  function loadProfile() {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }

  useEffect(loadProfile, [token]);

  function applyPatch(patch: Partial<Profile>) {
    setProfile((p) => (p ? { ...p, ...patch } : p));
  }

  if (status === "loading") return null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>My Profile</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 32 }}>
        This is how you appear on aisalon.xyz — the homepage team section and your chapter&apos;s
        page.
      </p>

      {loading && <p style={{ fontSize: 14, color: "#696969" }}>Loading…</p>}

      {!loading && loadError && (
        <div style={cardStyle}>
          <p style={{ fontSize: 14, color: "#ef4444", marginBottom: 12 }}>
            Couldn&apos;t load your profile. Please try again.
          </p>
          <button onClick={loadProfile} style={primaryBtnStyle}>
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && profile && token && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PhotoCard profile={profile} token={token} onSaved={applyPatch} />
          <InfoCard profile={profile} token={token} onSaved={applyPatch} />
          <AccountCard profile={profile} token={token} onSaved={applyPatch} />
        </div>
      )}
    </div>
  );
}
