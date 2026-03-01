"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chapters, setChapters] = useState<{ id: string; name: string; code: string }[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;
  const userChapterId = (session?.user as any)?.chapterId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/chapters`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        setChapters(data);
        // Pre-select chapter lead's chapter
        if (userRole === "chapter_lead" && userChapterId) {
          const ch = data.find((c: any) => c.id === userChapterId);
          if (ch) setChapterId(ch.id);
        } else if (data.length > 0) {
          setChapterId(data[0].id);
        }
      });
  }, [token, userRole, userChapterId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !chapterId) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("chapter_id", chapterId);
    const r = await fetch(`${API_URL}/admin/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    setUploading(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail ?? "Upload failed.");
      return;
    }
    router.push("/jobs");
  }

  const availableChapters =
    userRole === "chapter_lead"
      ? chapters.filter((c) => c.id === userChapterId)
      : chapters;

  if (status === "loading") return null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Upload Recording</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 40 }}>
        Upload an audio recording to generate an article. Processing happens asynchronously.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Chapter select */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#444", marginBottom: 8 }}>
              Chapter
            </label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={userRole === "chapter_lead"}
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 14,
                border: "1.5px solid #d1d5db",
                borderRadius: 6,
                background: "#fff",
                color: "#111",
              }}
            >
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* File upload */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#444", marginBottom: 8 }}>
              Audio File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #d1d5db",
                borderRadius: 8,
                padding: "32px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: file ? "#f0f9ff" : "#fafafa",
                transition: "border-color 0.15s",
              }}
            >
              <i className="fa fa-music" style={{ fontSize: 28, color: "#56a1d2", marginBottom: 12, display: "block" }} />
              {file ? (
                <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: 0 }}>{file.name}</p>
              ) : (
                <>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#444", margin: "0 0 4px" }}>
                    Click to select audio file
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>MP3, M4A, WAV, OGG supported</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!file || !chapterId || uploading}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              background: !file || !chapterId || uploading ? "#d1d5db" : "#56a1d2",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: !file || !chapterId || uploading ? "default" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {uploading ? "Uploading…" : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
