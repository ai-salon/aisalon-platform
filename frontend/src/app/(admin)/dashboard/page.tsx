import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import WelcomeDashboard from "./WelcomeDashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchJson<T>(url: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

interface ApiKey { provider: string; has_key: boolean }
interface Job { id: string; input_filename: string; status: string; created_at: string }
interface Article { id: string; title: string; status: string; created_at: string }
interface TeamMember { id: string; chapter_id: string }
interface ChapterRecord { id: string; code: string; name: string; tagline?: string; description?: string }
interface MeResponse { has_read_hosting_guide: boolean; has_read_lead_guide: boolean }

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as { accessToken?: string }).accessToken as string;
  const userRole: string = (session.user as { role?: string } | undefined)?.role ?? "chapter_lead";
  const userName: string = session.user?.name ?? "";
  const userEmail: string = session.user?.email ?? "";
  const userChapterId: string | undefined = (session.user as { chapterId?: string } | undefined)?.chapterId;

  const [apiKeys, jobs, articles, team, chapters, me] = await Promise.all([
    fetchJson<ApiKey[]>(`${API_URL}/admin/api-keys`, token),
    fetchJson<Job[]>(`${API_URL}/admin/jobs`, token),
    fetchJson<Article[]>(`${API_URL}/admin/articles`, token),
    fetchJson<TeamMember[]>(`${API_URL}/admin/team`, token),
    fetchJson<ChapterRecord[]>(`${API_URL}/chapters`, token),
    fetchJson<MeResponse>(`${API_URL}/admin/me`, token),
  ]);

  const hasApiKey = Array.isArray(apiKeys)
    ? apiKeys.some((k) => k.has_key)
    : false;

  const jobList = Array.isArray(jobs) ? jobs : [];
  const articleList = Array.isArray(articles) ? articles : [];
  const teamList = Array.isArray(team) ? team : [];
  const chapterList = Array.isArray(chapters) ? chapters : [];
  const hasReadHostingGuide = me?.has_read_hosting_guide ?? false;
  const hasReadLeadGuide = me?.has_read_lead_guide ?? false;

  let userChapter: ChapterRecord | undefined;
  if (userChapterId) {
    userChapter = chapterList.find((c) => c.id === userChapterId);
  }

  const chapterComplete = !!(userChapter?.tagline && userChapter?.description);

  let completedSteps: boolean[] | undefined;
  if (userRole === "host") {
    completedSteps = [hasApiKey, jobList.length > 0, articleList.length > 0, hasReadHostingGuide];
  } else if (userRole === "chapter_lead") {
    completedSteps = [hasApiKey, jobList.length > 0, chapterComplete, teamList.length > 0, hasReadHostingGuide, hasReadLeadGuide];
  }

  return (
    <WelcomeDashboard
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      userChapter={userChapter ? { id: userChapter.id, code: userChapter.code, name: userChapter.name } : undefined}
      allChapters={chapterList.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      completedSteps={completedSteps}
      hasReadHostingGuide={hasReadHostingGuide}
      hasReadLeadGuide={hasReadLeadGuide}
    />
  );
}
