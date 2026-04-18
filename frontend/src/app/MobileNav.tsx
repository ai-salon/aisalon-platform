"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type ChapterNav = { code: string; name: string };

export default function MobileNav({ chapters }: { chapters: ChapterNav[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 22,
          color: "#111",
          marginLeft: "auto",
          padding: 0,
        }}
      >
        <i className={`fa ${open ? "fa-times" : "fa-bars"}`} aria-hidden="true" />
      </button>

      {/* Overlay menu */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: 71,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#f8f6ec",
            zIndex: 9998,
            overflowY: "auto",
            padding: "24px 30px 40px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Nav sections */}
          <div style={{ flex: 1 }}>
            <NavSection label="About">
              <NavLink href="/#about" icon="fa-info-circle">About Us</NavLink>
              <NavLink href="/#values" icon="fa-heart">Values</NavLink>
              <NavLink href="/#team" icon="fa-users">Team</NavLink>
            </NavSection>

            <NavSection label="Explore">
              <NavLink href="/#events" icon="fa-calendar">Events</NavLink>
              <NavLink href="/insights" icon="fa-newspaper-o">Insights</NavLink>
            </NavSection>

            <NavSection label="Chapters">
              {chapters.map((ch) => (
                <NavLink key={ch.code} href={`/chapters/${ch.code}`} icon="fa-map-marker">{ch.name}</NavLink>
              ))}
              <NavLink href="/host" icon="fa-plus-circle">Start a Chapter</NavLink>
            </NavSection>

            <NavSection label="Get Involved">
              <NavLink href="/start" icon="fa-play-circle">Run a Salon</NavLink>
              <NavLink href="/volunteer" icon="fa-hand-paper-o">Volunteer</NavLink>
              <NavLink href="/host" icon="fa-users">Host a Chapter</NavLink>
            </NavSection>
          </div>

          {/* CTA button at bottom */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
            <a
              href="https://lu.ma/Ai-salon"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ textAlign: "center", display: "block" }}
            >
              Join an Event
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: 16, marginBottom: 16 }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "#d2b356",
        display: "block",
        marginBottom: 8,
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function NavLink({ href, icon, children, external }: {
  href: string; icon: string; children: React.ReactNode; external?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    fontSize: 16,
    fontWeight: 600,
    color: "#111",
    textDecoration: "none",
  };

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        <i className={`fa ${icon}`} style={{ color: "#56a1d2", width: 20, textAlign: "center" }} aria-hidden="true" />
        {children}
      </a>
    );
  }

  return (
    <Link href={href} style={style}>
      <i className={`fa ${icon}`} style={{ color: "#56a1d2", width: 20, textAlign: "center" }} aria-hidden="true" />
      {children}
    </Link>
  );
}
