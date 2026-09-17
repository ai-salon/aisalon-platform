"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import PhotoCropper from "@/components/PhotoCropper";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

export function photoSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

interface Props {
  /** Current photo URL ("" or null for none). */
  url: string | null;
  token: string;
  /** Who the photo is for; used in accessible labels. */
  label: string;
  /** Called with the uploaded URL, or "" when the photo is removed. */
  onChange: (url: string) => void;
  size?: number;
}

/**
 * Pick, crop, and upload a profile photo, then hand the stored URL back to the
 * form. Saving it onto an account is the caller's job, so the same control
 * works for creating and editing.
 */
export default function PhotoPicker({ url, token, label, onChange, size = 56 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const src = photoSrc(url);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setPendingFile(file);
  }

  async function onCropped(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const r = await fetch(`${API_URL}/profile/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        toast.error("Photo upload failed. Try again.");
        return;
      }
      const body = await r.json();
      onChange(body.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="fa fa-user" style={{ color: "#9ca3af", fontSize: size / 2.5 }} aria-hidden="true" />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <button
          type="button"
          aria-label={`${src ? "Change" : "Upload"} photo for ${label}`}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: 5, background: "#fff",
            border: "1.5px solid #d1d5db", color: "#374151", cursor: uploading ? "wait" : "pointer",
          }}
        >
          <i className="fa fa-camera" style={{ marginRight: 6 }} aria-hidden="true" />
          {uploading ? "Uploading…" : src ? "Change photo" : "Upload photo"}
        </button>
        {src && (
          <button
            type="button"
            aria-label={`Remove photo for ${label}`}
            onClick={() => onChange("")}
            style={{ padding: 0, fontSize: 12, background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", textDecoration: "underline" }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        aria-label={`Photo file for ${label}`}
        onChange={onFileSelected}
        style={{ display: "none" }}
      />
      {pendingFile && (
        <PhotoCropper file={pendingFile} onCancel={() => setPendingFile(null)} onConfirm={onCropped} />
      )}
    </div>
  );
}
