"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyBox, MarkdownCopyBox } from "./primitives";

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
  /** A screenshot of the component this step happens in. */
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
  eventDescription,
  regQuestions,
}: {
  eventTitle: string;
  eventDescription: string;
  regQuestions: string[];
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
      title: "Add the event title",
      detail: (
        <>
          Click <strong>Event Name</strong> and paste:
          <CopyBox content={eventTitle || "Ai Salon: [Theme]"} />
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
      title: "Fill out the description",
      detail: (
        <>
          Click <strong>Add Description</strong>. Start by pasting the template, then replace every{" "}
          <strong>[FILL IN]</strong> before you go public.
          <MarkdownCopyBox content={eventDescription} maxHeight={240} />
        </>
      ),
      pin: { x: RAIL_X, y: 53 },
    },
    {
      id: "approval",
      title: "Turn on Require Approval",
      detail: "This is how you curate the room — you'll review every registration. Expect to approve about half: accept 20–30 for 15 attendees. Leave Ticket Price as Free.",
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
          On the event&apos;s <strong>Overview</strong> tab → <strong>Hosts</strong> → Add Host, then paste:
          <CopyBox content="contact@aisalon.xyz" />
          This lets the core team help with approvals and promotion.
        </>
      ),
    },
    {
      id: "questions",
      title: "Add the 3 registration questions",
      detail: (
        <>
          <strong>Registration</strong> tab → <strong>Custom Questions</strong> → Add Question. Use{" "}
          <strong>Text</strong> for the first two and <strong>Social Profile</strong> (LinkedIn) for the third. Paste
          each one:
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
    {
      id: "public",
      title: "Go public 2–3 weeks out",
      detail: "Switch visibility back to Public once the description is final. You don't need the address yet.",
    },
  ];

  return { onCreatePage, afterCreate };
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

export default function LumaWalkthrough(props: {
  eventTitle: string;
  eventDescription: string;
  regQuestions: string[];
}) {
  const { onCreatePage, afterCreate } = buildSteps(props);
  const all = [...onCreatePage, ...afterCreate];
  const numberOf = (id: string) => all.findIndex((s) => s.id === id) + 1;

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  // Capacity's dialog screenshot is opt-in; after-create screenshots show by default.
  const [shotOpen, setShotOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(afterCreate.filter((s) => s.shot).map((s) => [s.id, true]))
  );
  const [createOpen, setCreateOpen] = useState(true);
  const [afterOpen, setAfterOpen] = useState(true);

  const createDone = onCreatePage.filter((s) => done[s.id]).length;
  const afterDone = afterCreate.filter((s) => done[s.id]).length;
  const doneCount = createDone + afterDone;

  function toggle(step: Step) {
    const nowDone = !done[step.id];
    const next = { ...done, [step.id]: nowDone };
    setDone(next);
    if (!nowDone) return;
    // Finishing a section folds it away and keeps focus on what's left.
    if (onCreatePage.includes(step) && onCreatePage.every((s) => next[s.id])) {
      setCreateOpen(false);
      setAfterOpen(true);
      scrollToId("luma-section-after");
    }
    if (afterCreate.includes(step) && afterCreate.every((s) => next[s.id])) {
      setAfterOpen(false);
    }
  }

  function focusStep(id: string) {
    setActive(id);
    scrollToId(`luma-step-${id}`);
  }

  function renderStep(step: Step) {
    const n = numberOf(step.id);
    const isDone = !!done[step.id];
    const isActive = active === step.id;
    const showShot = !!step.shot && !!shotOpen[step.id];
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
              onChange={() => toggle(step)}
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
            <>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "6px 0 0 27px" }}>{step.detail}</div>
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
                    aria-label={`${showShot ? "Hide" : "Show me"} how to ${step.title.toLowerCase()}`}
                    aria-expanded={showShot}
                    onClick={() => setShotOpen((o) => ({ ...o, [step.id]: !showShot }))}
                    style={linkButton}
                  >
                    {showShot ? "Hide screenshot ▲" : "🖼️ Show me ▼"}
                  </button>
                )}
              </div>
              {step.shot && showShot && (
                <div style={{ margin: "10px 0 0 27px", borderRadius: 8, overflow: "hidden", border: "1px solid #ede9d8" }}>
                  <Image
                    src={step.shot.src}
                    alt={step.shot.alt}
                    width={step.shot.width}
                    height={step.shot.height}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              )}
            </>
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
          marginBottom: 14,
          color: "#fff",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🗓️</span>
          <span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>Create your event here — open Luma</span>
            <span style={{ display: "block", fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              Opens in a new tab on the Ai Salon calendar. Keep this page beside it and paste as you go.
            </span>
          </span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>↗</span>
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
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

      <Section
        id="luma-section-create"
        title="On the Create Event page"
        doneCount={createDone}
        total={onCreatePage.length}
        open={createOpen}
        onToggle={() => setCreateOpen((o) => !o)}
      >
        {/* Annotated screenshot */}
        <div id="luma-create-shot" style={{ background: "#2a2217", borderRadius: 12, padding: 10, marginBottom: 14 }}>
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
            Click a number to jump to that step.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{onCreatePage.map(renderStep)}</div>
      </Section>

      <Section
        id="luma-section-after"
        title="After you click Create Event"
        doneCount={afterDone}
        total={afterCreate.length}
        open={afterOpen}
        onToggle={() => setAfterOpen((o) => !o)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{afterCreate.map(renderStep)}</div>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  doneCount,
  total,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  doneCount: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const complete = doneCount === total;
  return (
    <section id={id} style={{ marginBottom: 14, scrollMarginTop: 20 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          marginBottom: open ? 10 : 0,
          background: complete ? "#f0fdf4" : "#fdf9f0",
          border: `1px solid ${complete ? "#bbf7d0" : "#ede9d8"}`,
          borderRadius: 10,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>
          {complete ? "✅ " : ""}
          {title}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: complete ? "#16a34a" : "#696969" }}>
            {doneCount}/{total}
          </span>
          <span
            aria-hidden
            style={{
              color: "#d2b356",
              fontSize: 10,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            ▼
          </span>
        </span>
      </button>
      {open && <div id={`${id}-body`}>{children}</div>}
    </section>
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

const linkButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "none",
  color: "#56a1d2",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
