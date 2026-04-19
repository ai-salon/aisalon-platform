import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Open_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "./providers";
import MobileNav from "./MobileNav";
import NavLinks from "./NavLinks";

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
  title: "Ai Salon – The Global AI Commons",
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
            <NavLinks chapters={chapters} />

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
            </div>

            {/* Mobile hamburger */}
            <MobileNav chapters={chapters} />
          </div>
        </nav>

        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
