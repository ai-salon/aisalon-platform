import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleEditor from "./ArticleEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getArticle(token: string, id: string) {
  const r = await fetch(`${API_URL}/admin/articles/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch article");
  return r.json();
}

async function getSubstackPublicationUrl(token: string): Promise<string | null> {
  try {
    const r = await fetch(`${API_URL}/admin/substack-publication-url`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.publication_url ?? null;
  } catch {
    return null;
  }
}

async function getChapters(): Promise<{ id: string; name: string }[]> {
  try {
    const r = await fetch(`${API_URL}/chapters`, { cache: "no-store" });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const [article, substackPublicationUrl, chapters] = await Promise.all([
    getArticle(token, id),
    getSubstackPublicationUrl(token),
    getChapters(),
  ]);
  if (!article) notFound();

  const role = (session.user as any)?.role as string | undefined;
  const chapterName =
    chapters.find((c) => c.id === article.chapter_id)?.name ?? null;

  return (
    <Suspense>
      <ArticleEditor article={article} token={token} substackPublicationUrl={substackPublicationUrl} role={role} chapterName={chapterName} />
    </Suspense>
  );
}
