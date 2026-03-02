"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef9c3", color: "#a16207" },
  processing: { bg: "#dbeafe", color: "#1d4ed8" },
  completed:  { bg: "#dcfce7", color: "#16a34a" },
  failed:     { bg: "#fee2e2", color: "#dc2626" },
};

const TERMINAL = new Set(["completed", "failed"]);

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chapters, setChapters] = useState<{ id: string; name: string; code: string }[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [articleByJob, setArticleByJob] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;
  const userChapterId = (session?.user as any)?.chapterId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    // Fetch chapters
    fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setChapters(data);
        if (userRole === "chapter_lead" && userChapterId) {
          const ch = data.find((c: any) => c.id === userChapterId);
          if (ch) setChapterId(ch.id);
        } else if (data.length > 0) {
          setChapterId(data[0].id);
        }
      });
    // Fetch API keys
    fetch(`${API_URL}/admin/api-keys`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setApiKeys(data.map((k: any) => k.provider));
        setKeysLoaded(true);
      })
      .catch(() => setKeysLoaded(true));
  }, [token, userRole, userChapterId]);

  const fetchJobs = async () => {
    if (!token) return null;
    const [jobsRes, articlesRes] = await Promise.all([
      fetch(`${API_URL}/admin/jobs`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/admin/articles`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const jobsData = jobsRes.ok ? await jobsRes.json() : [];
    const articlesData = articlesRes.ok ? await articlesRes.json() : [];
    setJobs(jobsData);
    setLastUpdated(new Date());
    const map: Record<string, string> = {};
    for (const a of articlesData) if (a.job_id) map[a.job_id] = a.id;
    setArticleByJob(map);
    return jobsData;
  };

  useEffect(() => {
    if (!token) return;
    fetchJobs().then((jobsData) => {
      if (!jobsData) return;
      const hasActive = jobsData.some((j: any) => !TERMINAL.has(j.status));
      if (hasActive && !intervalRef.current) {
        intervalRef.current = setInterval(async () => {
          const refreshed = await fetchJobs();
          if (refreshed && refreshed.every((j: any) => TERMINAL.has(j.status))) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
          }
        }, 5000);
      }
    });
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    // Reset form and refresh jobs panel
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const jobsData = await fetchJobs();
    // Start polling if not already
    if (jobsData && jobsData.some((j: any) => !TERMINAL.has(j.status)) && !intervalRef.current) {
      intervalRef.current = setInterval(async () => {
        const refreshed = await fetchJobs();
        if (refreshed && refreshed.every((j: any) => TERMINAL.has(j.status))) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
      }, 5000);
    }
  }

  const availableChapters = userRole === "chapter_lead"
    ? chapters.filter((c) => c.id === userChapterId)
    : chapters;

  const missingKeys = keysLoaded && (!apiKeys.includes("assemblyai") || !apiKeys.includes("google"));

  if (status === "loading") return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 30px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Upload Conversations</h1>
      <p style={{ fontSize: 14, color: "#696969", marginBottom: 32 }}>
        Upload an audio recording to automatically generate an article.
      </p>

      {/* API key warning banner */}
      {missingKeys && (
        <div
          style={{
            background: "#fffbeb",
            border: "1.5px solid #f59e0b",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}>
              Add API keys before uploading
            </span>
          </div>
          <Link
            href="/settings"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: "#f59e0b",
              padding: "7px 16px",
              borderRadius: 6,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Go to Settings →
          </Link>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 32, alignItems: "start" }}>

        {/* LEFT: Upload form */}
        <div>
          {/* Cost notice */}
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 24,
              fontSize: 13,
              color: "#0369a1",
            }}
          >
            💳 Each upload uses ~$1 in API credits (AssemblyAI transcription + Gemini generation)
          </div>

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
                    <option key={c.id} value={c.id}>{c.name}</option>
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

              {error && <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>}

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

        {/* RIGHT: Jobs panel */}
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #ede9d8",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #f0ebe0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Processing History</span>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {jobs.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af" }}>
              <i className="fa fa-inbox" style={{ fontSize: 28, marginBottom: 10, display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>No jobs yet</p>
            </div>
          ) : (
            <div>
              {jobs.map((job: any, i: number) => {
                const s = STATUS_STYLES[job.status] ?? STATUS_STYLES.pending;
                const articleId = articleByJob[job.id];
                const isActive = !TERMINAL.has(job.status);
                return (
                  <div
                    key={job.id}
                    style={{
                      padding: "12px 18px",
                      borderBottom: i < jobs.length - 1 ? "1px solid #f8f6ec" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#111",
                            margin: "0 0 4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <i className="fa fa-file-audio-o" style={{ color: "#56a1d2", marginRight: 6 }} />
                          {job.input_filename ?? "Untitled"}
                        </p>
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 12,
                          background: s.bg,
                          color: s.color,
                          textTransform: isActive && job.step ? "none" : "capitalize",
                          flexShrink: 0,
                        }}
                      >
                        {isActive && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: s.color,
                              animation: "pulse 1.2s ease-in-out infinite",
                              display: "inline-block",
                            }}
                          />
                        )}
                        {isActive && job.step ? job.step : job.status}
                      </span>
                    </div>
                    {articleId && (
                      <Link
                        href={`/articles/${articleId}`}
                        style={{
                          display: "inline-block",
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#56a1d2",
                          textDecoration: "none",
                          border: "1.5px solid #56a1d2",
                          padding: "3px 10px",
                          borderRadius: 5,
                        }}
                      >
                        View Article →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
