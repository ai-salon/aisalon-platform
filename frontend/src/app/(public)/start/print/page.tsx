import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import PrintButton from "./PrintButton";
import AutoPrint from "./AutoPrint";

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

export default async function PrintPage() {
  const topics = await getTopics();

  return (
    <>
      <style>{`
        @media print {
          nav, footer, .no-print { display: none !important; }
          body { margin: 0; }
        }
        @media screen {
          body { background: #f0f0f0; }
          .print-page { max-width: 760px; margin: 24px auto; background: white; padding: 36px 44px; box-shadow: 0 2px 16px rgba(0,0,0,0.12); }
        }
      `}</style>

      <Suspense><AutoPrint /></Suspense>

      {/* Print button bar — screen only */}
      <div className="no-print" style={{ background: "#56a1d2", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/start" style={{ color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Back to Start page
        </Link>
        <PrintButton />
      </div>

      {/* Single page: Facilitation Guide */}
      <div className="print-page">

        {/* Header with logo */}
        <div style={{ borderBottom: "3px solid #56a1d2", paddingBottom: 12, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#56a1d2", marginBottom: 4 }}>
              Ai Salon
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#111" }}>
              Facilitation Guide
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
              Everything you need to run a great conversation.
            </p>
          </div>
          <Image src="/images/logo-2-300w.png" alt="Ai Salon" width={52} height={52} style={{ objectFit: "contain" }} />
        </div>

        {/* What it is */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#444", margin: "0 0 18px" }}>
          An Ai Salon is a small-group conversation where people from all backgrounds come together to explore a topic.
          No expertise required — just curiosity and a willingness to listen.
        </p>

        {/* Setting Up */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 10 }}>
            Setting Up
          </h2>
          <div style={{ display: "flex", gap: 14 }}>
            {[
              { n: "1", text: <><strong>Gather 4–12 people</strong> — friends, colleagues, neighbors.</> },
              { n: "2", text: <><strong>Pick a space</strong> — a living room, coffee shop, or office.</> },
              { n: "3", text: <><strong>Choose a topic</strong> — it can be about anything. See below for Ai Salon topic ideas.</> },
            ].map((s) => (
              <div key={s.n} style={{ flex: 1, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#56a1d2", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {s.n}
                </div>
                <p style={{ fontSize: 12, color: "#333", lineHeight: 1.5, margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Running the Conversation */}
        <div style={{ marginBottom: topics.length > 0 ? 20 : 0 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 10 }}>
            Running the Conversation
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", marginBottom: 6 }}>1. Introduce</div>
              <p style={{ fontSize: 12, color: "#444", lineHeight: 1.5, margin: "0 0 6px" }}>
                Frame what you&apos;re here to do:
              </p>
              <p style={{ fontSize: 12, fontStyle: "italic", color: "#333", lineHeight: 1.5, borderLeft: "2px solid #56a1d2", paddingLeft: 8, margin: 0 }}>
                &ldquo;We&apos;re here to talk about [topic]. No experts — just curious people. Here are a few values...&rdquo;
              </p>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", marginBottom: 6 }}>2. Share values</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontSize: 12, color: "#333", lineHeight: 1.4 }}>
                  <strong>Give &amp; Take Space</strong> — listen as much as you speak.
                </div>
                <div style={{ fontSize: 12, color: "#333", lineHeight: 1.4 }}>
                  <strong>Seek the Truth</strong> — say what you believe; be willing to change your mind.
                </div>
                <div style={{ fontSize: 12, color: "#333", lineHeight: 1.4 }}>
                  <strong>Encourage Exploration</strong> — let the conversation go where it wants.
                </div>
              </div>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", marginBottom: 6 }}>3. Introductions</div>
              <p style={{ fontSize: 12, color: "#444", lineHeight: 1.5, margin: "0 0 8px" }}>
                Go around: each person shares their name and what they want to explore today.
              </p>
              <p style={{ fontSize: 11, color: "#7a5c00", background: "#fffbf0", border: "1px solid #d2b356", borderRadius: 4, padding: "6px 8px", margin: 0, lineHeight: 1.4 }}>
                <strong>Go first and model what you want to see.</strong> Take a moment to genuinely describe what you&apos;re curious about — it gives others permission to do the same. What comes up tells you what&apos;s on people&apos;s minds.
              </p>
            </div>

            <div style={{ borderTop: "3px solid #56a1d2", paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", marginBottom: 6 }}>4. Opening question</div>
              <p style={{ fontSize: 12, color: "#444", lineHeight: 1.5, margin: 0 }}>
                Ask the opening question and let the conversation flow. Use follow-up prompts to go deeper when the energy calls for it.
              </p>
            </div>

          </div>
        </div>

        {/* Topics — shown only if any exist */}
        {topics.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#111", marginBottom: 10 }}>
              Topic Inspiration
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topics.map((topic) => (
                <div key={topic.id} style={{ borderLeft: "3px solid #56a1d2", paddingLeft: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px", color: "#111" }}>{topic.title}</h3>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                    Opening Question
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#333", margin: 0, lineHeight: 1.4 }}>
                    {topic.opening_question}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer with QR code */}
        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "2px solid #56a1d2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 3 }}>
              Want to get more involved?
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>
              Scan to learn about hosting an official Ai Salon chapter.
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>aisalon.xyz/host</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https%3A%2F%2Ffrontend-development-535c.up.railway.app%2Fhost&format=png&margin=2"
            alt="QR code: aisalon.xyz/host"
            width={80}
            height={80}
            style={{ display: "block" }}
          />
        </div>

      </div>
    </>
  );
}
