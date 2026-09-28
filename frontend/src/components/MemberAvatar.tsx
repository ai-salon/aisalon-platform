"use client";

import { useState, type CSSProperties } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Brand mark shown in place of a member photo when none is set (or it fails to load). */
export const LOGO_PLACEHOLDER_SRC = "/images/logo-2-300w.png";

/** Resolve a stored profile image URL to something the browser can load. */
export function photoSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

/**
 * Circular member avatar. Renders the member's photo when available, otherwise
 * the Ai Salon logo — never a generic "empty person" glyph.
 */
export default function MemberAvatar({
  url,
  name,
  size,
  background = "#f0ebe0",
  style,
}: {
  url: string | null | undefined;
  name: string;
  size: number;
  background?: string;
  style?: CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  const src = photoSrc(url);
  const showPhoto = Boolean(src) && !broken;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO_PLACEHOLDER_SRC}
          alt=""
          aria-hidden="true"
          data-testid="avatar-logo-placeholder"
          // The logo is ~3:2 landscape; 70% of the diameter keeps its corners
          // inside the circle with a little breathing room.
          style={{ width: "70%", height: "auto", display: "block" }}
        />
      )}
    </div>
  );
}
