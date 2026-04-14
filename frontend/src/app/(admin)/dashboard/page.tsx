import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import HostDashboard from "./HostDashboard";
import ChapterLeadDashboard from "./ChapterLeadDashboard";
import SuperadminDashboard from "./SuperadminDashboard";

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
interface Job { id: string; input_filename: string; status: string; created_at: string; chapter_id?: string }
interface Article { id: string; title: string; status: string; created_at: string; chapter_id?: string }
interface TeamMember { id: string; chapter_id: string }
interface ChapterRecord { id: string; code: string; name: string; tagline?: string; description?: string; is_active?: boolean }

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as { accessToken?: string }).accessToken as string;
  const userRole: string = (session.user as { role?: string } | undefined)?.role ?? "chapter_lead";
  const userName: string = session.user?.name ?? "";
  const userChapterId: string | undefined = (session.user as { chapterId?: string } | undefined)?.chapterId;

  const [apiKeys, jobs, articles, team, chapters] = await Promise.all([
    fetchJson<ApiKey[]>(`${API_URL}/admin/api-keys`, token),
    fetchJson<Job[]>(`${API_URL}/admin/jobs`, token),
    fetchJson<Article[]>(`${API_URL}/admin/articles`, token),
    fetchJson<TeamMember[]>(`${API_URL}/admin/team`, token),
    fetchJson<ChapterRecord[]>(`${API_URL}/chapters`, token),
  ]);

  const hasAssemblyAiKey = Array.isArray(apiKeys)
    ? apiKeys.some((k) => k.provider === "assemblyai" && k.has_key)
    : false;

  const jobList = Array.isArray(jobs) ? jobs : [];
  const articleList = Array.isArray(articles) ? articles : [];
  const teamList = Array.isArray(team) ? team : [];
  const chapterList = Array.isArray(chapters) ? chapters : [];

  let userChapter: ChapterRecord | undefined;
  if (userChapterId) {
    userChapter = chapterList.find((c) => c.id === userChapterId);
  }

  const chapterComplete = !!(userChapter?.tagline && userChapter?.description);
  const chapterName = userChapter?.name;

  if (userRole === "host") {
    const completedSteps: [boolean, boolean, boolean] = [
      hasAssemblyAiKey,
      jobList.length > 0,
      articleList.length > 0,
    ];
    return (
      <HostDashboard
        userName={userName}
        chapterName={chapterName}
        completedSteps={completedSteps}
        recentJobs={jobList.slice(0, 3)}
      />
    );
  }

  if (userRole === "chapter_lead") {
    const completedSteps: [boolean, boolean, boolean, boolean] = [
      hasAssemblyAiKey,
      jobList.length > 0,
      chapterComplete,
      teamList.length > 0,
    ];
    const publishedCount = articleList.filter((a) => a.status === "published").length;
    const draftCount = articleList.filter((a) => a.status === "draft").length;
    return (
      <ChapterLeadDashboard
        userName={userName}
        chapterName={chapterName}
        completedSteps={completedSteps}
        stats={{
          articlesPublished: publishedCount,
          articlesDraft: draftCount,
          teamCount: teamList.length,
        }}
        recentArticles={articleList.slice(0, 3)}
      />
    );
  }

  // superadmin
  const recentJobCount = jobList.filter((j) => {
    const d = new Date(j.created_at);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const chaptersWithStats = chapterList.map((ch) => ({
    id: ch.id,
    name: ch.name,
    code: ch.code,
    is_active: ch.is_active ?? true,
    articleCount: articleList.filter((a) => a.chapter_id === ch.id).length,
    teamCount: teamList.filter((t) => t.chapter_id === ch.id).length,
  }));

  return (
    <SuperadminDashboard
      userName={userName}
      platformStats={{
        totalChapters: chapterList.length,
        totalUsers: 0,
        recentJobs: recentJobCount,
      }}
      chapters={chaptersWithStats}
    />
  );
}
