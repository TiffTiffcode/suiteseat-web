// src/lib/fetchers.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://live-tx5y.onrender.com";

export async function fetchBusinessBySlug(slug: string) {
  const res = await fetch(`${API_BASE}/api/businesses/by-slug/${encodeURIComponent(slug)}`, {
    // Always fetch fresh for SSR
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch business (${res.status})`);
  return res.json();
}
