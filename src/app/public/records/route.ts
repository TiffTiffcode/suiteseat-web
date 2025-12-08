//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\public\records\route.ts
import { NextRequest, NextResponse } from "next/server";

// Read either var name (yours uses _URL). Fallback to localhost:8400 for dev.
const UPSTREAM =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8400";

export async function GET(req: NextRequest) {
  // Forward entire query string to your upstream
  const target = `${UPSTREAM.replace(/\/$/, "")}/public/records${req.nextUrl.search}`;

  try {
    const res = await fetch(target, { cache: "no-store" });
    const text = await res.text();

    // Try to return JSON if possible, otherwise pass through as text
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") || "text/plain" },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Proxy to /public/records failed",
        detail: String(err?.message || err),
        target,
      },
      { status: 502 }
    );
  }
}
