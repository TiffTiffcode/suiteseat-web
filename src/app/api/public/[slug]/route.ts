// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\public\[slug]\route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";
import { upstreamOrigin } from "@/app/_utils/origin";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }   // ✅ match Next 16's expected type
) {
  const { slug } = await context.params;           // ✅ await params to get slug
  const url = new URL(req.url);
  const search = url.search || "";

  // forward as: /api/public/:slug?...
  return proxy(req, `/api/public/${encodeURIComponent(slug)}${search}`);
}
