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

// 🔹 NEW: look up a Business record by slug using /public/records
async function fetchBusinessRecordBySlug(slug: string) {
  try {
    const params = new URLSearchParams();
    params.set("dataType", "Business");
    // field name in your DataType should be "Slug"
    params.set("Slug", slug);
    params.set("limit", "1");

    const url = `${API}/public/records?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.log("[page] business slug lookup HTTP", res.status);
      return null;
    }

    const raw = await res.json();
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.records)
      ? raw.records
      : Array.isArray(raw?.items)
      ? raw.items
      : [];

    return rows[0] || null;
  } catch (err) {
    console.log("[page] business slug lookup error", err);
    return null;
  }
}

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  // 0️⃣ NEW STEP: try Business DataType by slug (for *new* businesses)
  const dynamicBiz = await fetchBusinessRecordBySlug(slug);

  if (dynamicBiz) {
    const v = dynamicBiz.values ?? dynamicBiz;

    const rawType = (
      v["Page Type"] ||
      v["Page Kind"] ||
      dynamicBiz.pageType ||
      dynamicBiz.kind ||
      dynamicBiz.dataTypeName ||
      ""
    )
      .toString()
      .toLowerCase();

    const isLinkPage = rawType.includes("link");
    const isBookingPage =
      rawType.includes("booking") || rawType === "" || rawType.includes("business");
    const isSuitePage =
      rawType.includes("suite") || rawType.includes("location");

    const business = {
      _id: dynamicBiz._id ?? dynamicBiz.id,
      values: v,
      name: v.Name || v.name || slug,
      slug,
      description: v.Description || v.description || "",
      heroUrl: pickHeroUrlAny(v),
    };

    console.log("[page] dynamic Business match for slug", slug, "type:", rawType);

    // If you ever mark a Business as "link" type, we can still honor that:
    if (isLinkPage && !isBookingPage && !isSuitePage) {
      return (
        <LinkPageProvider slug={slug}>
          <LinkClient slug={slug} />
        </LinkPageProvider>
      );
    }

    if (isSuitePage && !isBookingPage) {
      return <SuiteClient biz={business} />;
    }

    // Default for Business = booking page
    return <BookingClient business={business} />;
  }

  // 1️⃣ Your *old* behavior: try BUSINESS JSON first
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

  // ✅ We *do* have a business JSON (legacy behavior)
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

  console.log("[page] slug (json):", slug, "rawType:", rawType);

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
