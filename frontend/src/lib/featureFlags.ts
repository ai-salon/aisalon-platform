const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PublicFlags = {
  insights_enabled: boolean;
};

const DEFAULTS: PublicFlags = {
  insights_enabled: false,
};

export async function getPublicFlags(): Promise<PublicFlags> {
  try {
    const r = await fetch(`${API_URL}/public-feature-flags`, {
      next: { revalidate: 30 },
    });
    if (!r.ok) return DEFAULTS;
    const data = (await r.json()) as Partial<PublicFlags>;
    return { ...DEFAULTS, ...data };
  } catch {
    return DEFAULTS;
  }
}
