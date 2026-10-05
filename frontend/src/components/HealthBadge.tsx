"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

export type HealthComponent = {
  key: string;
  group: string;
  label: string;
  points: number;
  max_points: number;
  detail: string;
  available: boolean;
};

export type ChapterHealth = {
  score: number;
  label: string;
  partial: boolean;
  components: HealthComponent[];
};

export const HEALTH_COLORS: Record<string, { bg: string; fg: string; bar: string }> = {
  Thriving: { bg: "#dcfce7", fg: "#166534", bar: "#16a34a" },
  Steady: { bg: "#e0f0fa", fg: "#1f5f8b", bar: "#56a1d2" },
  "Needs attention": { bg: "#fdf3d7", fg: "#7a5a12", bar: "#d2b356" },
  "At risk": { bg: "#fee2e2", fg: "#991b1b", bar: "#dc2626" },
};

const TOOLTIP_WIDTH = 320;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Score pill; hovering or focusing it shows the per-component breakdown. */
export default function HealthBadge({ health }: { health: ChapterHealth }) {
  const ref = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const colors = HEALTH_COLORS[health.label] ?? HEALTH_COLORS["At risk"];

  // Place after render, using the tooltip's real height: below the badge if it
  // fits, otherwise above, clamped to the viewport. Fixed positioning keeps the
  // table's horizontal scroll container from clipping it.
  useLayoutEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    const h = tipRef.current?.offsetHeight ?? 0;
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_WIDTH - 8));
    const fitsBelow = r.bottom + 8 + h <= window.innerHeight - 8;
    const top = fitsBelow ? r.bottom + 8 : Math.max(8, r.top - 8 - h);
    setPos({ top, left });
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => {
    setOpen(false);
    setPos({ top: -9999, left: -9999 });
  };

  const groups = ["Events", "Articles", "Hosts"].map((g) => ({
    name: g,
    items: health.components.filter((c) => c.group === g),
  }));

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tipId : undefined}
        aria-label={`Health ${health.score} of 100, ${health.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          borderRadius: 999,
          padding: "4px 10px",
          background: colors.bg,
          color: colors.fg,
          fontSize: 12,
          fontWeight: 700,
          cursor: "help",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{health.score}</span>
        <span style={{ fontWeight: 600 }}>{health.label}</span>
        {health.partial && <span title="Event data unavailable">*</span>}
      </button>
      {open && (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: TOOLTIP_WIDTH,
            zIndex: 1000,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            border: "1px solid #ede9d8",
            padding: "14px 16px",
            fontSize: 12,
            color: "#374151",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <strong style={{ fontSize: 13, color: "#111" }}>Community health</strong>
            <span style={{ fontWeight: 700, color: colors.fg }}>
              {health.score}/100 · {health.label}
            </span>
          </div>
          {groups.map((g) => {
            const got = g.items.reduce((s, c) => s + c.points, 0);
            const max = g.items.reduce((s, c) => s + c.max_points, 0);
            const unavailable = g.items.every((c) => !c.available);
            return (
              <div key={g.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#111", marginBottom: 4 }}>
                  <span>{g.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {unavailable ? "n/a" : `${fmt(got)} / ${max}`}
                  </span>
                </div>
                {g.items.map((c) => (
                  <div key={c.key} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{c.label}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums", color: "#696969" }}>
                        {c.available ? `${fmt(c.points)} / ${c.max_points}` : "n/a"}
                      </span>
                    </div>
                    <div style={{ height: 4, background: "#f1f1ec", borderRadius: 2, margin: "3px 0" }}>
                      <div
                        style={{
                          width: c.available ? `${(100 * c.points) / c.max_points}%` : 0,
                          height: "100%",
                          background: colors.bar,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 11 }}>{c.available ? c.detail : "Luma unavailable"}</div>
                  </div>
                ))}
              </div>
            );
          })}
          {health.partial && (
            <div style={{ fontSize: 11, color: "#7a5a12", borderTop: "1px solid #f1f1ec", paddingTop: 8 }}>
              Event data couldn&apos;t be loaded, so the score covers articles and hosts only.
            </div>
          )}
        </div>
      )}
    </>
  );
}
