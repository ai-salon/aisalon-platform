import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Salon",
  description: "AI Salon Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <span className="text-xl font-bold">AI Salon</span>
            <div className="flex gap-4">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
