"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "white", color: "#56a1d2", border: "none", padding: "8px 20px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
    >
      Print / Save as PDF
    </button>
  );
}
