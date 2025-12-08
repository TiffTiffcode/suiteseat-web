// src/app/api/records/route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

// Generic list/search: /api/records?dataType=Client&...  (or any type)
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || "";
  return proxy(req, `/api/records${qs}`);
}


// Generic create: POST { dataTypeId, createdBy, values }
export async function POST(req: NextRequest) {
  return proxy(req, `/api/records`);
}
