import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const qs = req.nextUrl.search || "";
  return proxy(req, `/records/${encodeURIComponent(params.type)}${qs}`);
}
export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  return proxy(req, `/records/${encodeURIComponent(params.type)}`);
}
