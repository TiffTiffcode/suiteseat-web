// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\records\[type]\route.ts
import { NextRequest, NextResponse } from "next/server";

type TypeParams = { type: string };

// TEMP DIAGNOSTIC: respond to GET so the browser can show JSON at /api/records/Appointment
export async function GET(
  req: NextRequest,
  context: { params: Promise<TypeParams> }   // ✅ Next 16 expects params as Promise
) {
  const { type } = await context.params;      // ✅ await params
  const target = `/api/records/${encodeURIComponent(type)}${
    req.nextUrl.search || ""
  }`;
  return NextResponse.json({
    ok: true,
    where: "app-route",
    wouldForwardTo: target,
  });
}

// TEMP DIAGNOSTIC: respond to POST similarly
export async function POST(
  _req: NextRequest,
  context: { params: Promise<TypeParams> }   // ✅ same pattern for POST
) {
  const { type } = await context.params;
  const target = `/api/records/${encodeURIComponent(type)}`;
  return NextResponse.json({
    ok: true,
    where: "app-route",
    wouldForwardTo: target,
  });
}
