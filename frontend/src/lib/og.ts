export type OgData = { image: string | null; description: string | null };

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

export async function fetchOgData(url: string): Promise<OgData> {
  try {
    const r = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AiSalon/1.0; +https://aisalon.xyz)" },
    });
    if (!r.ok) return { image: null, description: null };
    const html = await r.text();
    const imgMatch =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const descMatch =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
    return {
      image: imgMatch?.[1] ?? null,
      description: descMatch?.[1] ? decodeHtmlEntities(descMatch[1]) : null,
    };
  } catch {
    return { image: null, description: null };
  }
}
