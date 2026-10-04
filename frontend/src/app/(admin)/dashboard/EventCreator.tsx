"use client";

import { useRef, useState } from "react";
import LumaWalkthrough, { LUMA_CREATE_URL } from "./LumaWalkthrough";

const STEPS = [
  { id: "details", label: "Details", title: "What's your salon about?" },
  { id: "luma", label: "Set up on Luma", title: "Create it on Luma, step by step" },
  { id: "promote", label: "Promote", title: "Fill the room" },
] as const;

export default function EventCreator({
  chapterName,
  chapterCode,
}: {
  chapterName?: string;
  chapterCode?: string;
}) {
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<"general" | "expert">("general");
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const city = chapterName || "";
  const lumaTag = chapterCode || "";
  const hasTheme = !!theme.trim();

  const eventTitle = hasTheme ? `Ai Salon: ${theme}${lumaTag ? ` [${lumaTag.toUpperCase()}]` : ""}` : "";

  const expertNote =
    format === "expert"
      ? `\n\nThis is part of our Expert Series — a recurring monthly conversation on ${theme || "[THEME]"} with professionals who work closely with AI. We meet regularly to explore how this theme evolves over time.`
      : "";

  const eventDescription = `Join us for an intimate Ai Salon conversation on "${theme || "[THEME]"}".${expertNote}

[FILL IN: 2–3 sentences describing what makes this theme timely or interesting. What tension or question is at the heart of it? Why should someone show up?]

We'll explore questions like:
• [FILL IN: A specific question about this theme]
• [FILL IN: Another angle — personal, societal, or philosophical]
• [FILL IN: An open-ended question that invites diverse perspectives]

---
⏱️ Run of show:
[FILL IN: e.g. 7:00 PM – Doors open / 7:20 PM – Conversation begins / 9:30 PM – Wrap-up]

*This is an intimate conversation, and it matters deeply that everyone is present from the start. Out of respect for all attendees, we close the doors 20 minutes after we begin. If you're running late, please reach out in advance.*

---
[The Ai Salon](https://aisalon.xyz/) is a global community founded in San Francisco focused on intimate, small-sized group discussions on the sociological, economic, cultural, and philosophical impacts and meaning of AI developments. We host small group discussions, all of which you can find on [our calendar](https://lu.ma/ai-salon). You can find summaries of our [previous conversations on our substack](https://aisalon.substack.com/).

*Please be advised: Unfortunately, space is very limited at these in-person community events and we can not always accept everyone we would like to. If you are not accepted to this event, please try and come to another.*`;

  const regQuestions = [
    `What topics would you most want to explore in the context of "${theme || "[THEME]"}"?`,
    "What is your personal or professional relationship with AI?",
    "LinkedIn URL",
  ];

  const promotionChannels = [
    {
      emoji: "🗓️",
      label: "Luma — Global Ai Salon Calendar",
      desc: "Already covered if you created it from the button in step 2.",
      link: LUMA_CREATE_URL,
      linkLabel: "Ai Salon calendar →",
      primary: true,
    },
    ...(lumaTag
      ? [
          {
            emoji: "📍",
            label: `Luma — ${city || lumaTag} Local Feed`,
            desc: `Submit your event to appear in the local Luma aggregator for ${city || lumaTag}`,
            link: `https://lu.ma/${lumaTag}`,
            linkLabel: `Browse lu.ma/${lumaTag} →`,
          },
        ]
      : []),
    {
      emoji: "🤝",
      label: "Your chapter lead",
      desc: "Send them the event link — they'll share it in chapter and cross-chapter channels.",
      link: null,
      linkLabel: null,
    },
    {
      emoji: "💼",
      label: "LinkedIn",
      desc: "Post about the event and tag @The Ai Salon. Share in AI-focused groups and your network.",
      link: "https://www.linkedin.com/company/92632727/",
      linkLabel: "Ai Salon LinkedIn →",
    },
    {
      emoji: "𝕏",
      label: "X / Twitter",
      desc: "Post and tag @TheAISalonSF. Use hashtags: #AiSalon #AI #[YourCity]",
      link: "https://x.com/TheAISalonSF",
      linkLabel: "@TheAISalonSF →",
    },
    {
      emoji: "📰",
      label: "Local AI & Tech Newsletters",
      desc: "Reach out to city-specific newsletters, Substack writers, or community managers covering AI events in your area",
      link: null,
      linkLabel: null,
    },
    {
      emoji: "👥",
      label: "Meetup.com & Local Groups",
      desc: "Post in AI meetup groups, university AI clubs, or professional communities in your city",
      link: "https://www.meetup.com/find/?keywords=artificial+intelligence",
      linkLabel: "Find AI groups →",
    },
  ];

  function goTo(i: number) {
    setStep(i);
    setReached((r) => Math.max(r, i));
    topRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const canAdvance = step !== 0 || hasTheme;
  const isLast = step === STEPS.length - 1;

  return (
    <div ref={topRef} style={{ scrollMarginTop: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🗓️ Create Your Event</h2>
        <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
          Three short steps from idea to a live Luma page. Take them one at a time.
        </p>
      </div>

      {/* Progress */}
      <nav aria-label="Event setup steps" style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        {STEPS.map((s, i) => {
          const isCurrent = i === step;
          const isDone = i !== step && (i < step || i < reached);
          const reachable = i <= reached && (i === 0 || hasTheme);
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i === STEPS.length - 1 ? "0 0 auto" : 1 }}>
              <button
                type="button"
                onClick={() => reachable && goTo(i)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px 6px 6px",
                  borderRadius: 20,
                  border: "none",
                  background: isCurrent ? "#eff6ff" : "transparent",
                  cursor: reachable ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: isCurrent || isDone ? "#fff" : "#999",
                    background: isCurrent ? "#56a1d2" : isDone ? "#d2b356" : "#f0ebe0",
                  }}
                >
                  {isDone && !isCurrent ? "✓" : i + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? "#1d4ed8" : reachable ? "#444" : "#aaa" }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span style={{ flex: 1, height: 2, minWidth: 12, margin: "0 4px", background: i < reached ? "#d2b356" : "#ede9d8" }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* The one card on screen */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede9d8",
          borderRadius: 14,
          padding: "24px 26px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#d2b356", margin: "0 0 4px" }}>
          Step {step + 1} of {STEPS.length}
        </p>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 18px" }}>{STEPS[step].title}</h3>

        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <label htmlFor="event-theme" style={fieldLabel}>
                Theme / Topic *
              </label>
              <input
                id="event-theme"
                type="text"
                value={theme}
                autoFocus
                onChange={(e) => setTheme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hasTheme) goTo(1);
                }}
                placeholder="e.g. AI & Relationships, Future of Work, Creativity..."
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  border: "1.5px solid #ddd",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "#111",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <span style={fieldLabel}>Format</span>
              <div style={{ display: "flex", gap: 8 }}>
                {(["general", "expert"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={format === f}
                    onClick={() => setFormat(f)}
                    style={{
                      flex: 1,
                      padding: "11px 12px",
                      border: `1.5px solid ${format === f ? "#56a1d2" : "#ddd"}`,
                      borderRadius: 8,
                      background: format === f ? "#eff6ff" : "#fff",
                      color: format === f ? "#1d4ed8" : "#555",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {f === "general" ? "General Salon" : "Expert Series"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#999", margin: "5px 0 0" }}>
                {format === "general"
                  ? "Broad theme, diverse attendees — AI Enthused"
                  : "Deep expertise, recurring series — AI Empowered"}
              </p>
            </div>
            <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "#696969", margin: 0 }}>
              Next, we&apos;ll walk you through Luma with your title, description, and registration questions ready to
              paste at each step.
            </p>
          </div>
        )}

        {step === 1 && (
          <LumaWalkthrough
            eventTitle={eventTitle}
            eventDescription={eventDescription}
            regQuestions={regQuestions}
            chapterName={city}
            lumaTag={lumaTag}
          />
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#444", margin: "0 0 10px" }}>Where to promote your event</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {promotionChannels.map(({ emoji, label, desc, link, linkLabel, primary }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 12px",
                    background: primary ? "#eff6ff" : "#fafaf8",
                    border: `1px solid ${primary ? "#bfdbfe" : "#ede9d8"}`,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{label}</span>
                    {link && linkLabel && (
                      <>
                        {" · "}
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}
                        >
                          {linkLabel}
                        </a>
                      </>
                    )}
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid #f0ebe0",
            gap: 12,
          }}
        >
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} style={secondaryButton}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                setTheme("");
                setReached(0);
                goTo(0);
              }}
              style={secondaryButton}
            >
              Start another event
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => goTo(step + 1)}
              style={{
                padding: "11px 22px",
                background: canAdvance ? "#56a1d2" : "#ccc",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: canAdvance ? "pointer" : "not-allowed",
              }}
            >
              Next: {STEPS[step + 1].label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#444",
  marginBottom: 6,
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#555",
  border: "1.5px solid #ddd",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
