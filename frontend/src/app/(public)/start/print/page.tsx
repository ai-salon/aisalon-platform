import Link from "next/link";
import PrintButton from "./PrintButton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  description: string;
  opening_question: string;
  prompts: string[];
}

async function getTopics(): Promise<Topic[]> {
  try {
    const r = await fetch(`${API}/topics`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

const VALUES = [
  {
    title: "Give and Take Space",
    body: "Take the time to make your point, and actively listen when others are speaking.",
  },
  {
    title: "Seek the Truth",
    body: "Engage with curiosity and rigor. Ground what you say in what you actually believe, and be willing to change your mind.",
  },
  {
    title: "Encourage Exploration",
    body: "Let the conversation go where it wants to go. All angles are welcome.",
  },
];

export default async function PrintPage() {
  const topics = await getTopics();

  return (
    <>
      <style>{`
        @media print {
          nav, footer, .no-print { display: none !important; }
          body { margin: 0; }
          .page-break { page-break-after: always; }
        }
        @media screen {
          body { background: #f0f0f0; }
          .print-page { max-width: 760px; margin: 32px auto; background: white; padding: 56px 64px; box-shadow: 0 2px 16px rgba(0,0,0,0.12); }
        }
      `}</style>

      {/* Print button — screen only */}
      <div className="no-print" style={{ background: "#56a1d2", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/start" style={{ color: "white", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          ← Back to Start page
        </Link>
        <PrintButton />
      </div>

      {/* Page 1: Facilitation Guide */}
      <div className="print-page page-break">
        {/* Header */}
        <div style={{ borderBottom: "3px solid #56a1d2", paddingBottom: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#56a1d2", marginBottom: 6 }}>
            Ai Salon
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#111" }}>
            Facilitation Guide
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#666" }}>
            Everything you need to run a great conversation.
          </p>
        </div>

        {/* What it is */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#444", margin: 0 }}>
            An Ai Salon is a small-group conversation where people from all backgrounds
            come together to explore a topic together. No expertise required — just
            curiosity and a willingness to listen.
          </p>
        </div>

        {/* The steps */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 16 }}>
            Setting Up
          </h2>
          <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <li style={{ fontSize: 14, lineHeight: 1.6, color: "#333" }}>
              <strong>Gather 4–12 people</strong> — friends, colleagues, neighbors. Diverse perspectives make the best conversations.
            </li>
            <li style={{ fontSize: 14, lineHeight: 1.6, color: "#333" }}>
              <strong>Pick a space</strong> — a living room, coffee shop, or office. Somewhere comfortable where people can talk freely.
            </li>
            <li style={{ fontSize: 14, lineHeight: 1.6, color: "#333" }}>
              <strong>Choose a topic</strong> — it can be about anything. See page 2 for curated AI topics with opening questions and prompts.
            </li>
          </ol>
        </div>

        {/* Running the conversation */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 16 }}>
            Running the Conversation
          </h2>

          {/* 1. Intro */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>1. Introduce the conversation</h3>
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
              Frame what you&apos;re here to do. Something like:
            </p>
            <div style={{ borderLeft: "3px solid #56a1d2", paddingLeft: 14, fontStyle: "italic", fontSize: 14, color: "#333", lineHeight: 1.7 }}>
              &ldquo;We&apos;re here to talk together about [your topic]. There are no experts in this room —
              just curious people exploring together. Before we start, here are a few values
              that guide our conversation.&rdquo;
            </div>
          </div>

          {/* 2. Values */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#56a1d2", marginBottom: 10 }}>2. Share the values</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VALUES.map((v) => (
                <div key={v.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#56a1d2", marginTop: 6, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>
                    <strong>{v.title}</strong> — {v.body}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Introductions */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>3. Introductions</h3>
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>
              Go around the room. Ask each person to share their name and what they&apos;re
              most interested in exploring about today&apos;s topic.
            </p>
            <div style={{ background: "#fffbf0", border: "1px solid #d2b356", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              <strong style={{ color: "#111" }}>This moment matters.</strong> Listen carefully —
              the themes that come up in introductions will tell you what&apos;s on people&apos;s minds.
              It&apos;s also each person&apos;s first chance to contribute, and the group&apos;s first
              chance to listen to one another. Don&apos;t rush it.
            </div>
          </div>

          {/* 4. Opening question */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#56a1d2", marginBottom: 8 }}>4. Ask the opening question</h3>
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              Once everyone has introduced themselves, ask the opening question and let the conversation
              flow. Use follow-up prompts to go deeper when the energy calls for it.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #ddd", fontSize: 12, color: "#999", textAlign: "center" }}>
          aisalon.xyz/start — Join us at aisalon.xyz
        </div>
      </div>

      {/* Page 2: Topics */}
      <div className="print-page">
        {/* Header */}
        <div style={{ borderBottom: "3px solid #d2b356", paddingBottom: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#56a1d2", marginBottom: 6 }}>
            Ai Salon
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#111" }}>
            Topic Inspiration
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#666" }}>
            Your salon can be about anything — these are some of ours to get you started.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {topics.map((topic) => (
            <div key={topic.id} style={{ borderLeft: "3px solid #56a1d2", paddingLeft: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "#111" }}>
                {topic.title}
              </h3>
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.5, margin: "0 0 10px" }}>
                {topic.description}
              </p>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#56a1d2", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Opening Question
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#333", margin: "0 0 8px", lineHeight: 1.5 }}>
                {topic.opening_question}
              </p>
              {topic.prompts.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                    Follow-up Prompts
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                    {topic.prompts.map((p, i) => (
                      <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #ddd", fontSize: 12, color: "#999", textAlign: "center" }}>
          aisalon.xyz/start — Join us at aisalon.xyz
        </div>
      </div>
    </>
  );
}
