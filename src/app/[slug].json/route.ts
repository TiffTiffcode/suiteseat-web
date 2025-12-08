// src/app/[slug].json/route.ts
import { NextRequest, NextResponse } from "next/server";

const API =
  process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/+$/, "") ||
  "http://localhost:8400";

async function fetchJSON(path: string) {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (res.ok) return { ok: true as const, data: await res.json() };
  if (res.status === 404) return { ok: false as const, notFound: true as const };
  return { ok: false as const, status: res.status };
}

// GET /<slug>.json
export async function GET(
  req: NextRequest,
  _context: { params: Promise<{}> } // ✅ match what Next's validator expects
) {
  // URL will look like: https://your-site.com/myslug.json
  const url = new URL(req.url);
  const pathname = url.pathname; // e.g. "/myslug.json"
  const slug = pathname.replace(/^\/|\.json$/g, ""); // "myslug"

  // 1) Try STORE first
  const store = await fetchJSON(`/store/${encodeURIComponent(slug)}.json`);
  if (store.ok) {
    return NextResponse.json(
      { kind: "store", ...store.data },
      { headers: { "x-proxy": "booking" } }
    );
  }
  if (!store.ok && !(store as any).notFound) {
    return NextResponse.json(
      { error: "upstream_store_error" },
      { status: 502 }
    );
  }

  // 2) Fallback: BUSINESS
  const biz = await fetchJSON(`/${encodeURIComponent(slug)}.json`);
  if (biz.ok) {
    return NextResponse.json(
      { kind: "business", ...biz.data },
      { headers: { "x-proxy": "booking" } }
    );
  }
  if (!biz.ok && !(biz as any).notFound) {
    return NextResponse.json(
      { error: "upstream_business_error" },
      { status: 502 }
    );
  }

  // 3) Nothing matched
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
