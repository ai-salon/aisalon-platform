import Link from "next/link";
import { auth } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const isSuperadmin = userRole === "superadmin";
  const isHost = userRole === "host";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "fa-th-large" },
    { href: "/upload", label: "Upload Conversations", icon: "fa-upload" },
    { href: "/articles", label: "Articles", icon: "fa-file-text-o" },
    ...(!isHost ? [{ href: "/community", label: "Community", icon: "fa-bar-chart" }] : []),
    ...(!isHost ? [{ href: "/social", label: "Social Media", icon: "fa-share-alt" }] : []),
    ...(!isHost ? [{ href: "/chapters", label: "Chapters", icon: "fa-map-marker" }] : []),
    ...(!isHost ? [{ href: "/team", label: "Team", icon: "fa-users" }] : []),
    ...(isSuperadmin ? [{ href: "/users", label: "Users", icon: "fa-user-circle-o" }] : []),
    ...(!isHost ? [{ href: "/hosting-interest", label: "Host Interest", icon: "fa-star" }] : []),
    { href: "/settings", label: "Settings", icon: "fa-cog" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 71px)" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid rgba(0,0,0,0.07)",
          padding: "32px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 16px", flex: 1 }}>
          {navItems.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                color: "#444",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              className="admin-nav-link"
            >
              <i className={`fa ${icon}`} style={{ width: 16, textAlign: "center", color: "#56a1d2" }} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out at bottom */}
        <div style={{ padding: "0 16px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12 }}>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", background: "#fafaf8" }}>
        {children}
      </main>
    </div>
  );
}
