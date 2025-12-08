// src/app/[slug]/page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";
import LinkClient from "./LinkClient";
import { LinkPageProvider } from "./LinkFlows/linkPageFlow";
import SuiteClient from "./SuiteClient";

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

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1️⃣ Try BUSINESS JSON first (old booking behavior)
  const bizRes = await fetch(`${API}/${encodeURIComponent(slug)}.json`, {
    cache: "no-store",
  });

  if (!bizRes.ok) {
    console.log(
      "[page] slug.json not found, trying Suite location for slug",
      slug
    );

    // 2️⃣ Try SUITE LOCATION JSON when business JSON is missing
    const suiteRes = await fetch(
      `${API}/suite-location/${encodeURIComponent(slug)}.json`,
      {
        cache: "no-store",
      }
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

    // 3️⃣ FINAL FALLBACK: treat as Link Page (so old link-page slugs still work)
    return (
      <LinkPageProvider slug={slug}>
        <LinkClient slug={slug} />
      </LinkPageProvider>
    );
  }

  // ✅ We *do* have a business JSON
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

  // 👉  If the record says it's a link page, render link template
  if (isLinkPage && !isBookingPage && !isSuitePage) {
    return (
      <LinkPageProvider slug={slug}>
        <LinkClient slug={slug} />
      </LinkPageProvider>
    );
  }

  // Build common business object for booking/suite
  const business = {
    _id: biz._id,
    values: v,
    name: v.Name || v.name || slug,
    slug,
    description: v.Description || v.description || "",
    heroUrl: pickHeroUrlAny(v),
  };

  // 👉 If it's a suite page, use SuiteClient
  if (isSuitePage && !isBookingPage) {
    return <SuiteClient biz={business} />;
  }

  // 3️⃣ Default: booking page (business)
  console.log("[page] booking heroUrl:", business.heroUrl);
  return <BookingClient business={business} />;
}
