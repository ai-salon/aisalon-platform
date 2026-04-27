"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PhotoCropper from "@/components/PhotoCropper";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function ProfileCompletePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG or PNG image (HEIC not supported).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    setPendingFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null);
    setError(null);
    const fd = new FormData();
    fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    const token = (session as unknown as { accessToken?: string })?.accessToken;
    const r = await fetch(`${API_URL}/profile/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!r.ok) {
      setError("Photo upload failed. Try again.");
      return;
    }
    const body = await r.json();
    setPhotoUrl(body.url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !photoUrl) {
      setError("Name and a photo are required.");
      return;
    }
    setSubmitting(true);
    const token = (session as unknown as { accessToken?: string })?.accessToken;
    const r = await fetch(`${API_URL}/profile/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: name.trim(),
        profile_image_url: photoUrl,
        linkedin: linkedin.trim() || null,
        description: description.trim() || null,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError("Could not save profile. Please try again.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Complete your profile</h1>
      <p className="text-salon-muted mb-6">
        We need a name and photo before you can use the platform.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="border rounded px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-medium">Photo *</span>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_URL}${photoUrl}`}
              alt="Profile preview"
              className="w-32 h-32 rounded-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
              No photo
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileSelected}
            className="text-sm"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">LinkedIn URL (optional)</span>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            maxLength={512}
            className="border rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Description (optional, {description.length}/350)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 350))}
            maxLength={350}
            rows={4}
            className="border rounded px-3 py-2"
          />
        </label>

        {error ? <p className="text-red-600 text-sm">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || !name || !photoUrl}
          className="btn btn-primary self-start"
        >
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </form>

      {pendingFile ? (
        <PhotoCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </main>
  );
}
