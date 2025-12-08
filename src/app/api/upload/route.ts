// src/app/api/upload/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

export const dynamic = "force-dynamic"; // keep streaming/multipart intact

export async function POST(req: NextRequest) {
  // forward to your backend's real endpoint
  return proxy(req, "/api/upload");
}
