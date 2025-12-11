// src/app/[slug]/page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";
import LinkClient from "./LinkClient";
import SuiteClient from "./SuiteClient";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
export const dynamic = "force-dynamic";

// ---------- hero helpers ----------
function normalizeHeroPath(s: string) {
  const fixed = s.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (fixed.startsWith("/")) return `${API}${fixed}`;
  return `${API}/uploads/${fixed}`;
}

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

// ---------- main page ----------
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // ✅ Next 16: params is a Promise
  const { slug: rawSlug } = await params;
  const slug = (rawSlug || "").trim();

  if (!slug) {
    console.log("[page] missing slug param");
    return <div style={{ color: "red" }}>Page not found for slug.</div>;
  }

  // 1️⃣ Try BUSINESS JSON first (old booking behavior)
  try {
    const bizRes = await fetch(`${API}/${encodeURIComponent(slug)}.json`, {
      cache: "no-store",
    });

    if (bizRes.ok) {
      const biz = await bizRes.json();
      const v = biz?.values ?? {};

      const rawType = (
        v["Page Type"] ||
        v["Page Kind"] ||
        biz.pageType ||
        biz.kind ||
        biz.dataTypeName ||
        ""
      )
        .toString()
        .toLowerCase();

      const isLinkPage = rawType.includes("link");
      const isBookingPage = rawType.includes("booking");
      const isSuitePage =
        rawType.includes("suite") || rawType.includes("location");

      console.log("[page] slug:", slug, "rawType:", rawType);

      // 👉 If the record says it's a link page, render link template
      if (isLinkPage && !isBookingPage && !isSuitePage) {
        return <LinkClient slug={slug} />;
      }

      // Common business object
      const business = {
        _id: biz._id,
        values: v,
        name: v.Name || v.name || slug,
        slug,
        description: v.Description || v.description || "",
        heroUrl: pickHeroUrlAny(v),
      };

      // 👉 Suite layout
      if (isSuitePage && !isBookingPage) {
        return <SuiteClient biz={business} />;
      }

      // 3️⃣ Default: booking page (business)
      console.log("[page] booking heroUrl:", business.heroUrl);
      return <BookingClient business={business} />;
    }

    console.log(
      "[page] slug.json not found, trying Suite location for slug",
      slug
    );
  } catch (err) {
    console.error("[page] error fetching business JSON for slug", slug, err);
  }

  // 2️⃣ Try SUITE LOCATION JSON when business JSON is missing
  try {
    const suiteRes = await fetch(
      `${API}/suite-location/${encodeURIComponent(slug)}.json`,
      { cache: "no-store" }
    );

    if (suiteRes.ok) {
      const suite = await suiteRes.json();
      const v = suite?.values ?? {};

      const suiteBusiness = {
        _id: suite._id,
        values: v,
        name:
          v["Location Name"] ||
          v["Suite Location Name"] ||
          v.Name ||
          slug,
        slug,
        description: v.Description || v.details || "",
        heroUrl: pickHeroUrlAny(v),
      };

      console.log("[page] rendering SuiteClient for slug", slug);
      return <SuiteClient biz={suiteBusiness} />;
    }

    console.log(
      "[page] no business/suite JSON, falling back to LinkClient for slug",
      slug
    );
  } catch (err) {
    console.error("[page] error fetching suite JSON for slug", slug, err);
  }

  // 3️⃣ FINAL FALLBACK: treat as Link Page
  console.log("[page] using LinkClient fallback for slug", slug);
  return <LinkClient slug={slug} />;
}
