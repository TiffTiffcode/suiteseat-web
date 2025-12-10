// src/app/[slug]/page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";
import LinkClient from "./LinkClient";
import { LinkPageProvider } from "./LinkFlows/linkPageFlow";

// 🔹 Use your live API in production, localhost in dev
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://live-353x.onrender.com";

export const dynamic = "force-dynamic";

// ---------- hero helpers (same idea you already had) ----------
function normalizeHeroPath(s: string) {
  const fixed = s.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (fixed.startsWith("/")) return `${API_BASE}${fixed}`;
  return `${API_BASE}/uploads/${fixed}`;
}

// Look across a lot of likely fields (single value or array)
function pickHeroUrlAny(v: any): string | null {
  if (!v) return null;

  const candidates: any[] = [
    v.HeroImage,
    v.heroImage,
    v.hero_image,
    v.HeroURL,
    v.HeroUrl,
    v.heroUrl,
    v.heroURL,
    v.Hero,
    v.ImageURL,
    v.ImageUrl,
    v.imageUrl,
    v.Image,
    v.image,
    Array.isArray(v.Images) ? v.Images[0] : undefined,
    Array.isArray(v.images) ? v.images[0] : undefined,
    v.heroImageUrl,
    v.hero_image_url,
  ].filter(Boolean);

  if (!candidates.length) return null;
  const first = String(candidates[0]);
  return normalizeHeroPath(first);
}

// ---------- NEW: fetch Business directly by slug ----------
async function fetchBusinessBySlug(slug: string) {
  const params = new URLSearchParams();
  params.set("dataType", "Business");
  params.set("limit", "5");
  // try both "slug" and "Slug" in values, just in case
  params.set("values.slug", slug);
  params.set("values.Slug", slug);

  const res = await fetch(`${API_BASE}/public/records?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const body = await res.json();
  const row =
    (Array.isArray(body) && body[0]) ||
    body?.items?.[0] ||
    body?.records?.[0] ||
    body;

  return row || null;
}

// ---------- Page component ----------
export default async function Page({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);

  // 1️⃣ Try to load a Business with that slug
  const rec = await fetchBusinessBySlug(slug);

  if (!rec) {
    console.log("[page] no Business for slug, falling back to Link Page:", slug);

    // 2️⃣ If no Business, treat slug as a Link Page (old behavior)
    return (
      <LinkPageProvider slug={slug}>
        <LinkClient slug={slug} />
      </LinkPageProvider>
    );
  }

  const v = rec.values ?? {};

  const business = {
    _id: rec._id,
    values: v,
    name: v.businessName || v.Name || rec.name || slug,
    slug,
    description: v.Description || v.description || "",
    heroUrl: pickHeroUrlAny(v),
  };

  console.log("[page] booking business", { slug, heroUrl: business.heroUrl });

  // 3️⃣ Default: booking page for this Business
  return <BookingClient business={business} />;
}
