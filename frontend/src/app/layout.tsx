import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />
      </head>
      <body className={`${openSans.className} antialiased`}>
        {/* ── Navigation ── */}
        <nav
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

            {/* Nav links */}
            <ul
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
                <a
                  href="#about"
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
                  About <i className="fa fa-angle-down" style={{ fontSize: 12 }} />
                </a>
                <ul className="dropdown-menu" style={{ listStyle: "none", margin: 0, padding: "10px 0" }}>
                  <li><a href="#values">Values</a></li>
                  <li><a href="#chapters">Chapters</a></li>
                  <li><a href="#team">Team</a></li>
                </ul>
              </li>
              <li className="dropdown">
                <a
                  href="#events"
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
                  Our Work <i className="fa fa-angle-down" style={{ fontSize: 12 }} />
                </a>
                <ul className="dropdown-menu" style={{ listStyle: "none", margin: 0, padding: "10px 0" }}>
                  <li><a href="#events">Events</a></li>
                  <li><a href="#insights">Insights</a></li>
                </ul>
              </li>
            </ul>

            {/* Nav buttons */}
            <div style={{ display: "flex", gap: 12 }}>
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
          </div>
        </nav>

        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
