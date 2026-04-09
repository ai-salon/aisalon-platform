import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import MobileNav from "./MobileNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ChapterNav = { code: string; name: string };

async function getChapters(): Promise<ChapterNav[]> {
  try {
    const r = await fetch(`${API_URL}/chapters`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const data = await r.json();
    return data.map((c: { code: string; name: string }) => ({ code: c.code, name: c.name }));
  } catch {
    return [];
  }
}

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  display: "swap",
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Ai Salon – Shaping AI through conversation and community",
  description:
    "The Ai Salon is a global community bringing together scientists, founders, builders, and the curious to shape the future of AI through meaningful conversation.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chapters = await getChapters();
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />
      </head>
      <body className={`${openSans.className} antialiased`}>
        {/* Skip to content */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* ── Navigation ── */}
        <nav
          aria-label="Main navigation"
          style={{
            height: 71,
            background: "#f8f6ec",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            position: "sticky",
            top: 0,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              maxWidth: 1140,
              margin: "0 auto",
              padding: "0 30px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            {/* Logo */}
            <Link href="/" style={{ flexShrink: 0, marginRight: 8 }}>
              <Image
                src="/images/logo-2-300w.png"
                alt="Ai Salon"
                height={52}
                width={120}
                style={{ height: 52, width: "auto" }}
              />
            </Link>

            {/* Nav links — hidden on mobile */}
            <ul
              className="desktop-nav-links"
              style={{
                display: "flex",
                gap: 4,
                listStyle: "none",
                margin: 0,
                padding: 0,
                marginRight: "auto",
              }}
            >
              <li className="dropdown">
                <Link
                  href="/#about"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "#111",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  About <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
                </Link>
                <ul className="dropdown-menu" style={{ listStyle: "none", margin: 0, padding: "10px 0" }}>
                  <li><Link href="/#values">Values</Link></li>
                  <li><Link href="/#chapters">Chapters</Link></li>
                  <li><Link href="/#team">Team</Link></li>
                </ul>
              </li>
              <li className="dropdown">
                <Link
                  href="/#events"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "#111",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Our Work <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
                </Link>
                <ul className="dropdown-menu" style={{ listStyle: "none", margin: 0, padding: "10px 0" }}>
                  <li><Link href="/#events">Events</Link></li>
                  <li><Link href="/insights">Insights</Link></li>
                  <li><Link href="/volunteer">Volunteer</Link></li>
                </ul>
              </li>
              <li className="dropdown">
                <Link
                  href="/#chapters"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "#111",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Chapters <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
                </Link>
                <ul className="dropdown-menu" style={{ listStyle: "none", margin: 0, padding: "10px 0" }}>
                  {chapters.map((ch) => (
                    <li key={ch.code}><Link href={`/chapters/${ch.code}`}>{ch.name}</Link></li>
                  ))}
                  <li style={{ borderTop: "1px solid rgba(0,0,0,0.08)", marginTop: 4, paddingTop: 4 }}>
                    <Link href="/host">Start a Chapter</Link>
                  </li>
                </ul>
              </li>
            </ul>

            {/* Nav buttons — hidden on mobile */}
            <div className="desktop-nav-buttons" style={{ display: "flex", gap: 12 }}>
              <a
                href="https://lu.ma/Ai-salon"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-button"
              >
                Join an event
              </a>
              <a
                href="https://aisalon.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-button"
              >
                Explore our insights
              </a>
            </div>

            {/* Mobile hamburger */}
            <MobileNav chapters={chapters} />
          </div>
        </nav>

        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
