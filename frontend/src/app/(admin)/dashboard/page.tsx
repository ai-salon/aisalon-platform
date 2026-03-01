import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import WelcomeDashboard from "./WelcomeDashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getChapters(token: string) {
  const res = await fetch(`${API_URL}/chapters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const userRole: string = (session.user as any)?.role ?? "chapter_lead";
  const userName: string = session.user?.name ?? "";
  const userEmail: string = session.user?.email ?? "";
  const userChapterId: string | undefined = (session.user as any)?.chapterId;

  let userChapter: { code: string; name: string } | undefined;
  if (userChapterId) {
    const chapters = await getChapters(token);
    const ch = chapters.find((c: any) => c.id === userChapterId);
    if (ch) userChapter = { code: ch.code, name: ch.name };
  }

  return (
    <WelcomeDashboard
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      userChapter={userChapter}
    />
  );
}
