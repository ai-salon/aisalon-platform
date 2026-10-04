"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyBox } from "./primitives";

export const LUMA_CREATE_URL = "https://luma.com/create?calendar=cal-XHZLGpY8HDOAYm3";

interface Shot {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface Step {
  id: string;
  title: string;
  detail: React.ReactNode;
  /** Pointer position on the create-page screenshot, in % of width/height. */
  pin?: { x: number; y: number };
  /** A second screenshot for steps that happen in a dialog or another tab. */
  shot?: Shot;
}

const CREATE_PAGE: Shot = {
  src: "/images/luma/create-page.png",
  alt: "Luma Create Event page with numbered pointers",
  width: 1087,
  height: 704,
};

// Pins sit in the gutter left of Luma's form fields so they never cover the label.
const RAIL_X = 36.6;

function buildSteps({
  eventTitle,
  regQuestions,
  chapterName,
  lumaTag,
}: {
  eventTitle: string;
  regQuestions: string[];
  chapterName?: string;
  lumaTag?: string;
}): { onCreatePage: Step[]; afterCreate: Step[] } {
  const onCreatePage: Step[] = [
    {
      id: "calendar",
      title: "Check it's under “the ai salon”",
      detail: "The calendar picker at the top. Our Create link pre-selects it — just confirm it didn't switch to your personal calendar.",
      pin: { x: RAIL_X, y: 11.1 },
    },
    {
      id: "visibility",
      title: "Set visibility to Private",
      detail: "Top-right dropdown: Public → Private. You'll go public 2–3 weeks before the event (last step).",
      pin: { x: 91.2, y: 11.1 },
    },
    {
      id: "name",
      title: "Paste your event title",
      detail: (
        <>
          Click <strong>Event Name</strong> and paste: <code style={codeStyle}>{eventTitle || "Ai Salon: [Theme]"}</code>
        </>
      ),
      pin: { x: RAIL_X, y: 19.3 },
    },
    {
      id: "time",
      title: "Set the date & time",
      detail: "Start and end should match the run of show in your description. Check the timezone box on the right.",
      pin: { x: RAIL_X, y: 31.5 },
    },
    {
      id: "location",
      title: "Add the location",
      detail: "Fine to add later if the venue isn't locked. Keep the address hidden until guests are approved.",
      pin: { x: RAIL_X, y: 43.8 },
    },
    {
      id: "description",
      title: "Paste the event description",
      detail: "From step 2. Replace every [FILL IN] before you go public.",
      pin: { x: RAIL_X, y: 53 },
    },
    {
      id: "approval",
      title: "Turn on Require Approval",
      detail: "This is how you curate the room — you'll review every registration. Leave Ticket Price as Free.",
      pin: { x: RAIL_X, y: 70.6 },
    },
    {
      id: "capacity",
      title: "Limit capacity",
      detail: "Click Capacity → toggle Limit Event Capacity → set Max Capacity to your room size (usually 15–20). Only approved guests count toward it. Leave the waitlist off.",
      pin: { x: RAIL_X, y: 76.3 },
      shot: {
        src: "/images/luma/capacity.png",
        alt: "Luma Max Capacity dialog with Limit Event Capacity turned on",
        width: 1034,
        height: 708,
      },
    },
    {
      id: "create",
      title: "Click Create Event",
      detail: "Luma opens your event's management page — the rest happens there.",
      pin: { x: RAIL_X, y: 87.9 },
    },
  ];

  const afterCreate: Step[] = [
    {
      id: "cohost",
      title: "Add contact@aisalon.xyz as a co-host",
      detail: (
        <>
          On the event&apos;s <strong>Overview</strong> tab → <strong>Hosts</strong> → Add Host →{" "}
          <code style={codeStyle}>contact@aisalon.xyz</code>. This lets the core team help with approvals and
          promotion.
        </>
      ),
    },
    {
      id: "questions",
      title: "Add the 3 registration questions",
      detail: (
        <>
          <strong>Registration</strong> tab → <strong>Custom Questions</strong> → Add Question. Use{" "}
          <strong>Text</strong> for the first two and <strong>Social Profile</strong> (LinkedIn) for the third.
          {regQuestions.map((q) => (
            <CopyBox key={q} content={q} />
          ))}
        </>
      ),
      shot: {
        src: "/images/luma/registration-questions.png",
        alt: "Luma Registration tab: Custom Questions and the Add Question dialog",
        width: 947,
        height: 868,
      },
    },
    ...(lumaTag
      ? [
          {
            id: "tag",
            title: `Tag it “${lumaTag}”`,
            detail: (
              <>
                So it shows on the{" "}
                <a
                  href={`https://lu.ma/Ai-salon?tag=${lumaTag}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#56a1d2", fontWeight: 600 }}
                >
                  Ai Salon {chapterName || lumaTag} calendar ↗
                </a>
                .
              </>
            ),
          },
        ]
      : []),
    {
      id: "public",
      title: "Go public 2–3 weeks out",
      detail: "Switch visibility back to Public once the description is final. You don't need the address yet.",
    },
  ];

  return { onCreatePage, afterCreate };
}

const codeStyle: React.CSSProperties = {
  background: "#f8f6ec",
  padding: "1px 6px",
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

export default function LumaWalkthrough(props: {
  eventTitle: string;
  regQuestions: string[];
  chapterName?: string;
  lumaTag?: string;
}) {
  const { onCreatePage, afterCreate } = buildSteps(props);
  const all = [...onCreatePage, ...afterCreate];
  const numberOf = (id: string) => all.findIndex((s) => s.id === id) + 1;

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  const [openShot, setOpenShot] = useState<string | null>(null);
  const doneCount = all.filter((s) => done[s.id]).length;

  function focusStep(id: string) {
    setActive(id);
    scrollToId(`luma-step-${id}`);
  }

  function renderStep(step: Step) {
    const n = numberOf(step.id);
    const isDone = !!done[step.id];
    const isActive = active === step.id;
    return (
      <div
        key={step.id}
        id={`luma-step-${step.id}`}
        data-testid={`luma-step-${step.id}`}
        data-active={isActive ? "true" : "false"}
        style={{
          display: "flex",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 10,
          border: `1.5px solid ${isActive ? "#d2b356" : "#ede9d8"}`,
          background: isDone ? "#f8f6ec" : isActive ? "#fffaf0" : "#fff",
          boxShadow: isActive ? "0 0 0 4px rgba(210,179,86,0.18)" : "none",
          transition: "all 0.15s",
        }}
      >
        <PinBadge n={n} done={isDone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isDone}
              onChange={() => setDone((d) => ({ ...d, [step.id]: !isDone }))}
              style={{ width: 17, height: 17, accentColor: "#d2b356", cursor: "pointer", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isDone ? "#aaa" : "#111",
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {step.title}
            </span>
          </label>
          {!isDone && (
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "6px 0 0 27px" }}>{step.detail}</div>
          )}
          <div style={{ display: "flex", gap: 14, margin: "8px 0 0 27px", flexWrap: "wrap" }}>
            {step.pin && (
              <button
                type="button"
                onClick={() => {
                  setActive(step.id);
                  scrollToId("luma-create-shot");
                }}
                style={linkButton}
              >
                📍 Show on screenshot
              </button>
            )}
            {step.shot && (
              <button
                type="button"
                aria-label={`Show me how to ${step.title.toLowerCase()}`}
                aria-expanded={openShot === step.id}
                onClick={() => setOpenShot(openShot === step.id ? null : step.id)}
                style={linkButton}
              >
                {openShot === step.id ? "Hide screenshot ▲" : "🖼️ Show me ▼"}
              </button>
            )}
          </div>
          {step.shot && openShot === step.id && (
            <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: "1px solid #ede9d8" }}>
              <Image
                src={step.shot.src}
                alt={step.shot.alt}
                width={step.shot.width}
                height={step.shot.height}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <a
        href={LUMA_CREATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "linear-gradient(135deg, #56a1d2 0%, #3d7fb8 100%)",
          borderRadius: 10,
          textDecoration: "none",
          marginBottom: 18,
          color: "#fff",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🗓️</span>
          <span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>Open Luma&apos;s Create Event page</span>
            <span style={{ display: "block", fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              Opens in a new tab on the Ai Salon calendar — keep this page beside it
            </span>
          </span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>↗</span>
      </a>

      {/* Annotated screenshot */}
      <div
        id="luma-create-shot"
        style={{ background: "#2a2217", borderRadius: 12, padding: 10, marginBottom: 18 }}
      >
        <div style={{ position: "relative", lineHeight: 0 }}>
          <Image
            src={CREATE_PAGE.src}
            alt={CREATE_PAGE.alt}
            width={CREATE_PAGE.width}
            height={CREATE_PAGE.height}
            priority
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
          />
          {onCreatePage.map((step) => {
            const n = numberOf(step.id);
            const isActive = active === step.id;
            return (
              <button
                key={step.id}
                type="button"
                aria-label={`Pointer ${n}: ${step.title}`}
                title={step.title}
                onClick={() => focusStep(step.id)}
                style={{
                  position: "absolute",
                  left: `${step.pin!.x}%`,
                  top: `${step.pin!.y}%`,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1.2 : 1})`,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                }}
              >
                <PinBadge n={n} done={!!done[step.id]} glow={isActive} />
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "#d8cfb5", margin: "8px 4px 2px", lineHeight: 1.5 }}>
          Click a number to jump to that step. Steps {onCreatePage.length + 1}–{all.length} happen after you click
          Create Event.
        </p>
      </div>

      {/* Checklist */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 8, background: "#f0ebe0", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${(doneCount / all.length) * 100}%`,
              height: "100%",
              background: "#d2b356",
              transition: "width 0.2s",
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#696969", whiteSpace: "nowrap" }}>
          {doneCount} of {all.length} done
        </span>
      </div>

      <GroupHeading>On the Create Event page</GroupHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {onCreatePage.map(renderStep)}
      </div>

      <GroupHeading>After you click Create Event</GroupHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{afterCreate.map(renderStep)}</div>
    </div>
  );
}

function PinBadge({ n, done, glow }: { n: number; done: boolean; glow?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1,
        color: "#fff",
        background: done ? "#16a34a" : "#d2b356",
        border: "2px solid #fff",
        boxShadow: glow ? "0 0 0 5px rgba(210,179,86,0.55)" : "0 1px 4px rgba(0,0,0,0.35)",
      }}
    >
      {done ? "✓" : n}
    </span>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        color: "#d2b356",
        margin: "0 0 8px 2px",
      }}
    >
      {children}
    </p>
  );
}

const linkButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "none",
  color: "#56a1d2",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
