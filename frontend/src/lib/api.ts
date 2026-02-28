const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface HealthResponse {
  status: string;
  version: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
