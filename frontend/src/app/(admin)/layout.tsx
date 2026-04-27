import { redirect } from "next/navigation";
import SidebarNav from "./SidebarNav";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getChapterName(token: string, chapterId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_URL}/chapters`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const chapters = await res.json();
    const ch = chapters.find((c: { id: string; name: string }) => c.id === chapterId);
    return ch?.name;
  } catch {
    return undefined;
  }
}

async function isProfileIncomplete(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const me = await res.json();
    return !me.profile_completed_at;
  } catch {
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Attempt to pre-load the chapter name for the sidebar badge.
  // SidebarNav reads session client-side, so auth failure here doesn't hide the sidebar.
  let chapterName: string | undefined;
  let token: string | undefined;
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    token = (session as { accessToken?: string } | null)?.accessToken;
    const chapterId = (session?.user as { chapterId?: string } | undefined)?.chapterId;
    if (token && chapterId) {
      chapterName = await getChapterName(token, chapterId);
    }
  } catch {
    // Non-fatal — sidebar will still render without chapter name
  }

  // Gate admin pages on profile completion. Outside the try/catch because
  // redirect() throws a NEXT_REDIRECT error that must not be swallowed.
  if (token && (await isProfileIncomplete(token))) {
    redirect("/profile/complete");
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 71px)" }}>
      {/* Sidebar — always rendered; SidebarNav gates its content on session */}
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
        <SidebarNav chapterName={chapterName} />
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", background: "#fafaf8" }}>
        {children}
      </main>
    </div>
  );
}
