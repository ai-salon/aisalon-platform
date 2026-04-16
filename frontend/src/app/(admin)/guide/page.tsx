import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import WelcomeDashboard from "../dashboard/WelcomeDashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function GuidePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as { accessToken?: string }).accessToken as string;
  const userRole: string = (session.user as { role?: string } | undefined)?.role ?? "";
  const userName: string = session.user?.name ?? "";
  const userEmail: string = session.user?.email ?? "";
  const userChapterId: string | undefined = (session.user as { chapterId?: string } | undefined)?.chapterId;

  let allChapters: { id: string; code: string; name: string }[] = [];
  try {
    const r = await fetch(`${API_URL}/chapters`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.ok) allChapters = await r.json();
  } catch {}

  const userChapter = userChapterId
    ? allChapters.find((c) => c.id === userChapterId)
    : undefined;

  return (
    <WelcomeDashboard
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      userChapter={userChapter}
      allChapters={allChapters}
    />
  );
}
