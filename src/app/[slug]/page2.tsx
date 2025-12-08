// src/app/[slug]/page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
export const dynamic = "force-dynamic";

// Accept Windows backslashes, absolute URLs, server-relative, or bare filenames
function normalizeHeroPath(s: string) {
  const fixed = s.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (fixed.startsWith("/")) return `${API}${fixed}`;
  return `${API}/uploads/${fixed}`;
}

// Look across a lot of likely fields (single value or array)
function pickHeroUrlAny(v: any): string | null {
  if (!v) return null;

  const candidates: any[] = [
    v.HeroImage, v.heroImage, v.hero_image,
    v.HeroURL, v.HeroUrl, v.heroUrl, v.heroURL,
    v.Hero, v.ImageURL, v.ImageUrl, v.imageUrl,
    v.Image, v.image,
    Array.isArray(v.Images) ? v.Images[0] : undefined,
    Array.isArray(v.images) ? v.images[0] : undefined,
    v.heroImageUrl, v.hero_image_url,
  ].filter(Boolean);

  if (!candidates.length) return null;
  const first = String(candidates[0]);
  return normalizeHeroPath(first);
}

export default async function Page({
  // ✅ Next 15+ wants you to await params
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // fetch your business JSON
  const r = await fetch(`${API}/${encodeURIComponent(slug)}.json`, { cache: "no-store" });
  if (!r.ok) return <main style={{ padding: 24 }}><h1>Not found</h1></main>;

  const biz = await r.json();
  const v   = biz?.values ?? {};

  const business = {
    _id: biz._id,
    name: v.Name || v.name || slug,
    slug,
    description: v.Description || v.description || "",
    heroUrl: pickHeroUrlAny(v),
  };

  // (server) log once; shows in your terminal running `next dev`
  console.log("[page] slug:", slug, "heroUrl:", business.heroUrl);

  return <BookingClient business={business} />;
}
