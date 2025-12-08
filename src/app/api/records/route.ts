// src/app/api/records/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || "";
  return proxy(req, `/api/records${qs}`);
}
export async function POST(req: NextRequest) {
  return proxy(req, `/api/records`);
}
