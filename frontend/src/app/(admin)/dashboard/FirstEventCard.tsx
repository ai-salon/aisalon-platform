"use client";

import { useOnboardingChecks } from "./OnboardingChecks";

/**
 * The centre of host onboarding: everything else builds toward running the
 * first salon. Collapses to a "next event" nudge once that check is saved.
 */
export default function FirstEventCard({
  doneKey,
  leadName,
  onCreateEvent,
  onOpenGuide,
}: {
  /** Saved check that marks the first event as hosted. */
  doneKey: string;
  leadName?: string;
  onCreateEvent: () => void;
  onOpenGuide: () => void;
}) {
  const checks = useOnboardingChecks();

  if (checks[doneKey]) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          background: "#fff",
          border: "1px solid #ede9d8",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>🎉 First salon hosted — nice work.</span>
        <button type="button" onClick={onCreateEvent} style={primaryButton}>
          Create your next event →
        </button>
      </div>
    );
  }

  const path = [
    { emoji: "🤝", title: "Talk to your lead", desc: leadName ? `Book a 1:1 with ${leadName} and ask for support.` : "Book a 1:1 and ask for support." },
    { emoji: "💡", title: "Pick a theme & space", desc: "8–20 people, somewhere comfortable and quiet." },
    { emoji: "🗓️", title: "Create it on Luma", desc: "We walk you through every setting." },
    { emoji: "🎤", title: "Run it & upload", desc: "Record the conversation; we turn it into an article." },
  ];

  return (
    <section
      aria-labelledby="first-salon-heading"
      style={{
        background: "linear-gradient(135deg, #fdf9f0 0%, #eff6ff 100%)",
        border: "1.5px solid #d2b356",
        borderRadius: 14,
        padding: "22px 24px",
        marginBottom: 20,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#d2b356", margin: "0 0 4px" }}>
        Your main goal
      </p>
      <h2 id="first-salon-heading" style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>
        🎯 Your first salon
      </h2>
      <p style={{ fontSize: 13, color: "#555", margin: "0 0 18px", lineHeight: 1.6 }}>
        Everything in onboarding builds toward hosting your first Ai Salon. Here&apos;s the path:
      </p>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {path.map((p, i) => (
          <li
            key={p.title}
            style={{ background: "#fff", border: "1px solid #ede9d8", borderRadius: 10, padding: "12px 14px" }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#56a1d2", marginBottom: 4 }}>
              {i + 1} · {p.emoji}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: "#696969", lineHeight: 1.5 }}>{p.desc}</div>
          </li>
        ))}
      </ol>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={onCreateEvent} style={{ ...primaryButton, padding: "12px 22px", fontSize: 14 }}>
          Create your event →
        </button>
        <button
          type="button"
          onClick={onOpenGuide}
          style={{ padding: "12px 18px", background: "transparent", border: "none", color: "#56a1d2", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Prep with the guide
        </button>
      </div>
    </section>
  );
}

const primaryButton: React.CSSProperties = {
  padding: "9px 16px",
  background: "#56a1d2",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
