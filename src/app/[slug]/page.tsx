// src/app/[slug]/page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";
import LinkClient from "./LinkClient";
import { LinkPageProvider } from "./LinkFlows/linkPageFlow";
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

// ---------- helpers to fetch data ----------

// 1) legacy .json business (old system)
async function fetchLegacyBusiness(slug: string) {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(slug)}.json`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const biz = await res.json();
    console.log("[page] legacy business JSON hit for slug", slug);
    return biz;
  } catch (err) {
    console.error("[page] legacy JSON error for slug", slug, err);
    return null;
  }
}

// 2) NEW: dynamic Business record from your DataType/Record API
async function fetchDynamicBusiness(slug: string) {
  const cleanSlug = (slug || "").trim();
  const slugLower = cleanSlug.toLowerCase();

  if (!slugLower) return null;

  try {
    const params = new URLSearchParams();
    params.set("dataType", "Business");
    params.set("limit", "500"); // grab a chunk & filter in JS

    const url = `${API}/public/records?${params.toString()}`;
    console.log("[page] dynamic Business lookup URL:", url);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.log("[page] dynamic Business lookup not ok:", res.status);
      return null;
    }

    const body = await res.json();

    const list: any[] =
      Array.isArray(body)
        ? body
        : Array.isArray(body.records)
        ? body.records
        : Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.data)
        ? body.data
        : [];

    // Try to match by any reasonable slug/name field
    const match =
      list.find((r: any) => {
        const v = r?.values || {};

        const candidates = [
          v.slug,
          v.Slug,
          r.slug,
          v.Name,
          v["Business Name"],
          v["Business"],
          v["Business name"],
          v["Page Slug"],
        ]
          .filter(Boolean)
          .map((x: any) => String(x).trim().toLowerCase());

        return candidates.includes(slugLower);
      }) || null;

    if (match) {
      console.log("[page] dynamic Business match for slug", slug, {
        id: match._id,
        values: {
          Name: match?.values?.Name,
          BusinessName: match?.values?.["Business Name"],
          slug: match?.values?.slug,
        },
      });
    } else {
      console.log("[page] NO dynamic Business match for slug", slug);
    }

    return match;
  } catch (err) {
    console.error("[page] dynamic Business lookup failed for slug", slug, err);
    return null;
  }
}

// 3) suite-location JSON (old system)
async function fetchSuiteLocation(slug: string) {
  try {
    const res = await fetch(
      `${API}/suite-location/${encodeURIComponent(slug)}.json`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const suite = await res.json();
    console.log("[page] suite-location JSON hit for slug", slug);
    return suite;
  } catch (err) {
    console.error("[page] suite-location error for slug", slug, err);
    return null;
  }
}

// ---------- main page component ----------

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  // 1️⃣ Try legacy business .json (old booking behavior)
  let biz: any | null = await fetchLegacyBusiness(slug);

  // 2️⃣ If no legacy file, try NEW dynamic Business lookup
  if (!biz) {
    biz = await fetchDynamicBusiness(slug);
  }

  // 3️⃣ If still nothing, try Suite Location JSON
  if (!biz) {
    const suite = await fetchSuiteLocation(slug);
    if (suite) {
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
  }

  // 4️⃣ If no business/suite at all, treat slug as Link Page / Store / Course
  if (!biz) {
    console.log(
      "[page] no business/suite for slug, falling back to LinkClient",
      slug
    );
    return (
      <LinkPageProvider slug={slug}>
        <LinkClient slug={slug} />
      </LinkPageProvider>
    );
  }

  // ---------- We *do* have a business-like object at this point ----------

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

  const isLinkPage =
    rawType.includes("link") ||
    rawType.includes("store") ||
    rawType.includes("course");
  const isBookingPage =
    rawType.includes("booking") || rawType.includes("appointment");
  const isSuitePage =
    rawType.includes("suite") || rawType.includes("location");

  console.log("[page] slug:", slug, "rawType:", rawType);

  // 👉 if this record is actually a Link / Store / Course page, render link template
  if (isLinkPage && !isBookingPage && !isSuitePage) {
    console.log("[page] record says link/store/course page – using LinkClient");
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

  // 👉 suite-style layout if type says suite/location
  if (isSuitePage && !isBookingPage) {
    console.log("[page] treating as suite page");
    return <SuiteClient biz={business} />;
  }

  // 5️⃣ Default: booking page (business)
  console.log("[page] booking heroUrl:", business.heroUrl);
  return <BookingClient business={business} />;
}
