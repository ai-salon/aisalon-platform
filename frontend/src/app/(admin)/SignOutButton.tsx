"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ redirectTo: "/login" })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 500,
        color: "#9ca3af",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
      }}
    >
      <i className="fa fa-sign-out" style={{ width: 16, textAlign: "center" }} />
      Sign out
    </button>
  );
}
