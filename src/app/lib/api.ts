export const API = process.env.NEXT_PUBLIC_API_BASE || "";

export async function getBusinessBySlug(slug: string) {
  // adjust the endpoint to whatever your 8400 server exposes
  const res = await fetch(`${API}/public/business-by-slug/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load business for ${slug}`);
  return res.json();
}

export async function getCalendars(businessId: string) {
  const res = await fetch(`${API}/public/records?dataType=Calendar&Business=${businessId}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
