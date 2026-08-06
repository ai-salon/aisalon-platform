import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOgData, type OgData } from "@/lib/og";
import { getPublicFlags } from "@/lib/featureFlags";
import ChapterView, { type ArticleCard, type Member } from "@/components/ChapterView";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Chapter = {
  id: string; code: string; name: string; title: string;
  description: string; tagline: string; about: string;
  event_link: string; calendar_embed: string; events_description: string;
  status: string;
};

async function getChapter(code: string): Promise<Chapter | null> {
  try {
    const r = await fetch(`${API_URL}/chapters/${code}`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function getChapterArticles(chapterId: string): Promise<ArticleCard[]> {
  try {
    const r = await fetch(`${API_URL}/articles?chapter_id=${chapterId}`, { cache: "no-store" });
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const chapter = await getChapter(code);
  if (!chapter) return { title: "Chapter – Ai Salon" };
  return { title: `${chapter.name} – Ai Salon` };
}

export default async function ChapterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const chapter = await getChapter(code);
  if (!chapter) notFound();

  const flags = await getPublicFlags();
  const articles = await getChapterArticles(chapter.id);
  const ogResults = await Promise.allSettled(
    articles.map((a) => a.substack_url ? fetchOgData(a.substack_url) : Promise.resolve({ image: null, description: null }))
  );
  const ogMap: Record<string, OgData> = {};
  articles.forEach((a, i) => {
    const r = ogResults[i];
    ogMap[a.id] = r.status === "fulfilled" ? r.value : { image: null, description: null };
  });

  async function getChapterTeam(code: string): Promise<Member[]> {
    try {
      const r = await fetch(`${API_URL}/team`, { cache: "no-store" });
      if (!r.ok) return [];
      const all: Member[] = await r.json();
      return all.filter((m) => m.chapter_code === code);
    } catch {
      return [];
    }
  }
  const sortedMembers = await getChapterTeam(chapter.code);

  return (
    <ChapterView
      chapter={chapter}
      articles={articles}
      ogMap={ogMap}
      members={sortedMembers}
      insightsEnabled={flags.insights_enabled}
      contactSlot={null}
    />
  );
}
