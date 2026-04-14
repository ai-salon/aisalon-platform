import { auth } from "@/lib/auth";
import SignOutButton from "./SignOutButton";
import AdminNav from "./AdminNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getChapterName(token: string, chapterId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_URL}/chapters`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    const chapters = await res.json();
    const ch = chapters.find((c: { id: string; name: string }) => c.id === chapterId);
    return ch?.name;
  } catch {
    return undefined;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userRole: string = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isSuperadmin = userRole === "superadmin";
  const isHost = userRole === "host";
  const userChapterId: string | undefined = (session?.user as { chapterId?: string } | undefined)?.chapterId;
  const token: string | undefined = (session as { accessToken?: string } | null)?.accessToken;

  let chapterName: string | undefined;
  if (token && userChapterId) {
    chapterName = await getChapterName(token, userChapterId);
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "fa-th-large" },
    { href: "/upload", label: "Upload Conversations", icon: "fa-upload" },
    { href: "/articles", label: "Articles", icon: "fa-file-text-o" },
    ...(!isHost ? [{ href: "/community", label: "Community", icon: "fa-bar-chart" }] : []),
    ...(!isHost ? [{ href: "/social", label: "Social Media", icon: "fa-share-alt" }] : []),
    ...(!isHost ? [{ href: "/chapters", label: "Chapters", icon: "fa-map-marker" }] : []),
    ...(!isHost ? [{ href: "/team", label: "Team", icon: "fa-users" }] : []),
    ...(isSuperadmin ? [{ href: "/users", label: "Users", icon: "fa-user-circle-o" }] : []),
    ...(!isHost ? [{ href: "/volunteer-roles", label: "Volunteer Roles", icon: "fa-hand-paper-o" }] : []),
    ...(!isHost ? [{ href: "/volunteer-applications", label: "Applications", icon: "fa-envelope-open-o" }] : []),
    ...(!isHost ? [{ href: "/topics", label: "Topics", icon: "fa-lightbulb-o" }] : []),
    ...(!isHost ? [{ href: "/community-uploads", label: "Community Uploads", icon: "fa-cloud-upload" }] : []),
    ...(!isHost ? [{ href: "/hosting-interest", label: "Host Interest", icon: "fa-star" }] : []),
    { href: "/settings", label: "Settings", icon: "fa-cog" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 71px)" }}>
      {/* Sidebar — hidden when not logged in */}
      {session && (
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
          <AdminNav navItems={navItems} userRole={userRole} chapterName={chapterName} />

          {/* Sign out at bottom */}
          <div style={{ padding: "0 16px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12 }}>
            <SignOutButton />
          </div>
        </aside>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", background: "#fafaf8" }}>
        {children}
      </main>
    </div>
  );
}
