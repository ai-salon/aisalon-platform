import { notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Member = {
  id: string; name: string; role: string;
  description: string | null; profile_image_url: string;
  linkedin: string | null; is_cofounder: boolean;
};

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string; team_members: Member[];
};

async function getChapter(code: string): Promise<Chapter | null> {
  const r = await fetch(`${API_URL}/chapters/${code}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch chapter");
  return r.json();
}

export default async function ChapterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const chapter = await getChapter(code);
  if (!chapter) notFound();

  const cofounders = chapter.team_members.filter((m) => m.is_cofounder);
  const others = chapter.team_members.filter((m) => !m.is_cofounder);
  const sortedMembers = [...cofounders, ...others];

  return (
    <div>
      {/* Hero */}
      <section style={{ background: "#56a1d2", color: "#fff", padding: "80px 30px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>
            Ai Salon · {chapter.name}
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15 }}>
            {chapter.title}
          </h1>
          <p style={{ fontSize: 20, lineHeight: 1.6, margin: "0 0 32px", maxWidth: 680, opacity: 0.92 }}>
            {chapter.tagline}
          </p>
          {chapter.event_link && (
            <a
              href={chapter.event_link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                background: "#fff",
                color: "#56a1d2",
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 4,
                textDecoration: "none",
              }}
            >
              Join an Event
            </a>
          )}
        </div>
      </section>

      {/* About */}
      <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 24 }}
            className="section-title"
          >
            About
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "#333" }}>{chapter.about}</p>
        </div>
      </section>

      {/* Team */}
      {sortedMembers.length > 0 && (
        <section style={{ background: "#fff", padding: "72px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2
              style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 40 }}
              className="section-title"
            >
              Team
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 28 }}>
              {sortedMembers.map((m) => (
                <div key={m.id} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      background: "#f8f6ec",
                      margin: "0 auto 14px",
                      overflow: "hidden",
                      border: "3px solid #d2b356",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {m.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.profile_image_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <i className="fa fa-user" style={{ fontSize: 36, color: "#d2b356" }} />
                    )}
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{m.name}</h4>
                  <p style={{ fontSize: 13, color: "#56a1d2", fontWeight: 600, margin: "0 0 6px" }}>{m.role}</p>
                  {m.is_cofounder && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "#eff6ff", color: "#56a1d2" }}>
                      Co-founder
                    </span>
                  )}
                  {m.linkedin && (
                    <div style={{ marginTop: 8 }}>
                      <a href={m.linkedin} target="_blank" rel="noreferrer" style={{ color: "#696969", fontSize: 16 }}>
                        <i className="fa fa-linkedin-square" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Events */}
      {chapter.calendar_embed && (
        <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2
              style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 12 }}
              className="section-title"
            >
              Events
            </h2>
            <p style={{ fontSize: 15, color: "#696969", marginBottom: 32 }}>{chapter.events_description}</p>
            <iframe
              src={chapter.calendar_embed}
              width="100%"
              height="450"
              style={{ border: "none", borderRadius: 8 }}
              title={`${chapter.name} events calendar`}
            />
          </div>
        </section>
      )}

      {/* Back link */}
      <div style={{ background: "#fff", padding: "40px 30px", textAlign: "center" }}>
        <Link href="/" style={{ fontSize: 14, color: "#56a1d2", textDecoration: "none", fontWeight: 600 }}>
          ← Back to all chapters
        </Link>
      </div>
    </div>
  );
}
