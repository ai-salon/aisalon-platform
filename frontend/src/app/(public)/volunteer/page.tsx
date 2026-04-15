"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Role = {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  time_commitment: string | null;
  chapter_id: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
  display_order: number;
};

function VolunteerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedChapter = searchParams.get("chapter") ?? "";

  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/volunteer-roles`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllRoles)
      .catch(() => setAllRoles([]))
      .finally(() => setLoading(false));
  }, []);

  // Extract unique chapters that have at least one role
  const chapters = Array.from(
    new Map(
      allRoles
        .filter((r) => r.chapter_code && r.chapter_name)
        .map((r) => [r.chapter_code!, { code: r.chapter_code!, name: r.chapter_name! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Filter roles: if a chapter is selected, show global + that chapter's roles
  const visibleRoles = selectedChapter
    ? allRoles.filter(
        (r) => !r.chapter_id || r.chapter_code === selectedChapter
      )
    : allRoles;

  function handleChapterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val) {
      router.push(`/volunteer?chapter=${val}`);
    } else {
      router.push("/volunteer");
    }
  }

  return (
    <div>
      {/* ── HERO ── */}
      <section id="banner" style={{ minHeight: "calc(50vh - 71px)" }}>
        <div className="banner-image" />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 30px", position: "relative", zIndex: 2 }}>
          <div style={{ paddingTop: 72, paddingBottom: 60 }}>
            <div style={{ width: 40, height: 4, background: "#d2b356", marginBottom: 24 }} />
            <h1 style={{ fontSize: 48, fontWeight: 800, color: "#111", margin: "0 0 16px", lineHeight: 1.15 }}>
              Join the Ai Salon
            </h1>
            <p style={{ fontSize: 20, color: "#696969", lineHeight: 1.6, margin: "0 0 32px", maxWidth: 560 }}>
              We&apos;re building a global community of people who care about AI&apos;s
              impact on society. Find a role that fits your skills and passion.
            </p>
            <div style={{ width: 40, height: 4, background: "#d2b356" }} />
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ marginBottom: 52 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <span className="section-label">Volunteer</span>
              <h2 className="section-title" style={{ display: "inline-block" }}>
                Open Roles
              </h2>
              <p style={{ fontSize: 17, color: "#696969", lineHeight: 1.6, maxWidth: 600, margin: "16px auto 0" }}>
                Every role is volunteer-based and remote-friendly. Join us in shaping
                how the world talks about AI.
              </p>
            </div>

            {/* Chapter filter — only shown if there are chapter-specific roles */}
            {chapters.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#696969", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Filter by Chapter
                  </label>
                  <select
                    value={selectedChapter}
                    onChange={handleChapterChange}
                    style={{
                      padding: "8px 14px",
                      border: "1.5px solid #e1e1e1",
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: "inherit",
                      background: "#fff",
                      color: "#111",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">All Chapters</option>
                    {chapters.map((ch) => (
                      <option key={ch.code} value={ch.code}>{ch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── ROLE CARDS ── */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#696969" }}>Loading roles...</div>
          ) : visibleRoles.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#696969" }}>
              <i className="fa fa-clock-o" style={{ fontSize: 32, color: "#d1d5db", marginBottom: 12, display: "block" }} />
              <p style={{ fontSize: 15, margin: 0 }}>No open roles at the moment. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
              {visibleRoles.map((role) => (
                <Link
                  key={role.id}
                  href={`/volunteer/${role.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 10,
                      padding: "32px 28px",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                      borderLeft: "4px solid #56a1d2",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    className="icon-block"
                  >
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 10, marginTop: 0 }}>
                      {role.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      {/* Location tag */}
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: "#fff",
                        background: role.chapter_code ? "#d2b356" : "#9ca3af",
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}>
                        {role.chapter_name ?? "Global"}
                      </span>
                      {role.time_commitment && (
                        <span style={{ fontSize: 13, color: "#56a1d2", fontWeight: 600 }}>
                          <i className="fa fa-clock-o" style={{ marginRight: 5 }} />
                          {role.time_commitment}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: "#696969", lineHeight: 1.6, margin: 0, flex: 1 }}>
                      {role.description.split("\n").find(l => l.trim() && !l.startsWith("#"))?.slice(0, 160)}...
                    </p>
                    <div style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: "#56a1d2" }}>
                      Learn More & Apply <i className="fa fa-arrow-right" style={{ marginLeft: 4 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function VolunteerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: "center", color: "#696969" }}>Loading...</div>}>
      <VolunteerContent />
    </Suspense>
  );
}
