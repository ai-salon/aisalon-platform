"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function VerifyInner() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [email, setEmail] = useState("");
  const firedRef = useRef(false);
  useEffect(() => {
    if (!token) { setState("error"); return; }
    if (firedRef.current) return;
    firedRef.current = true;
    fetch(`${API_URL}/auth/verify-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.json();
        setEmail(b.email);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [token]);
  return (
    <section style={{ background: "#f8f6ec", minHeight: "60vh", padding: "96px 30px", textAlign: "center" }}>
      {state === "working" && <p className="section-subtitle">Confirming your new email…</p>}
      {state === "ok" && (
        <>
          <h2 className="section-title" style={{ display: "inline-block" }}>Email updated</h2>
          <p className="section-subtitle">Your login email is now <b>{email}</b>.</p>
        </>
      )}
      {state === "error" && (
        <>
          <h2 className="section-title" style={{ display: "inline-block" }}>Link invalid or expired</h2>
          <p className="section-subtitle">Request a new verification email from your profile page.</p>
        </>
      )}
    </section>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
