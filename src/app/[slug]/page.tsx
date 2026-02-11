// src/app/[slug]/page.tsx
//src\app\[slug]\page.tsx
import "./styles/BookingPage/basic.css";
import BookingClient from "./BookingClient";
import LinkClient from "./LinkClient";
import SuiteClient from "./SuiteClient";
import CourseClient from "./CourseClient"; 

import ThemeLoader from "./StoreTemplates/ThemeLoader";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

//Create Store 
async function fetchStoreBySlug(slug: string) {
  const qs = new URLSearchParams({ dataType: "Store", limit: "400" });

  const res = await fetch(`${API}/public/records?${qs.toString()}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.items || data.records || [];

  const want = slug.trim().toLowerCase();
  return (
    rows.find((r: any) => {
      const v = r?.values || {};
      const s = String(v.slug || v.Slug || v["Store Slug"] || "").trim().toLowerCase();
      return s === want;
    }) || null
  );
}

function readRefId(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v._id || v.id || "";
  return "";
}

async function fetchStoreThemeById(themeId: string) {
  if (!themeId) return null;

  const qs = new URLSearchParams({ dataType: "Store Theme", limit: "400" });
  const res = await fetch(`${API}/public/records?${qs.toString()}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.items || data.records || [];

  return rows.find((r: any) => String(r._id || r.id) === String(themeId)) || null;
}

//Create Course 
async function fetchCourseBySlug(slug: string) {
  const qs = new URLSearchParams({ dataType: "Course", limit: "200" });

  const res = await fetch(`${API}/public/records?${qs.toString()}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.items || data.records || [];

  const want = slug.trim().toLowerCase();

  return (
    rows.find((r: any) => {
      const v = r?.values || {};
      const s = String(
        v.slug ||
          v.courseSlug ||
          v.CourseSlug ||
          v["Course Slug"] ||
          ""
      )
        .trim()
        .toLowerCase();
      return s === want;
    }) || null
  );
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

  // 0️⃣ Try COURSE record by slug first
  try {
    const courseRec = await fetchCourseBySlug(slug);

    if (courseRec) {
      const v = courseRec.values || {};

      const course = {
        _id: courseRec._id || courseRec.id,
        values: v,
        name:
          v["Course Title"] ||
          v.Title ||
          v.Name ||
          v["Course Name"] ||
          slug,
        slug: String(v.slug || v.courseSlug || v.CourseSlug || slug),
        description: v.Description || v["Short description"] || "",
        heroUrl: pickHeroUrlAny(v),
      };

      console.log("[page] rendering CourseClient for slug", slug);
      return <CourseClient course={course} />;
    }
  } catch (err) {
    console.error("[page] error fetching course for slug", slug, err);
  }
// ✅ 0.5️⃣ Try STORE record by slug
try {
  const storeRec = await fetchStoreBySlug(slug);

  if (storeRec) {
    const v = storeRec?.values || {};

    // Store must have a Reference field called "Store Theme"
    const themeId = readRefId(v["Store Theme"]);
    const themeRec = themeId ? await fetchStoreThemeById(themeId) : null;

    console.log("[page] rendering StoreClient for slug", slug, "themeId:", themeId);

  const tv = themeRec?.values || {};
const templateKey =
  tv.templateKey ||
  tv["Template Key"] ||
  tv.key ||
  "basic";

return (
  <ThemeLoader
    templateKey={templateKey}
    store={storeRec}
    theme={themeRec}
    slug={slug}
  />
);


  }
} catch (err) {
  console.error("[page] error fetching store for slug", slug, err);
}


  // 1️⃣ Try BUSINESS JSON first (old booking behavior)
  try {
    const bizRes = await fetch(`${API}/${encodeURIComponent(slug)}.json`, {
      cache: "no-store",
      next: { revalidate: 0 },
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
  {
    cache: "no-store",
    next: { revalidate: 0 },
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
  } catch (err) {
    console.error("[page] error fetching suite JSON for slug", slug, err);
  }

  // 3️⃣ FINAL FALLBACK: treat as Link Page
  console.log("[page] using LinkClient fallback for slug", slug);
  return <LinkClient slug={slug} />;
}

