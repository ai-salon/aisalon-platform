import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
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

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const token = (session as any).accessToken as string;
  const article = await getArticle(token, id);
  if (!article) notFound();

  return <ArticleEditor article={article} token={token} />;
}
