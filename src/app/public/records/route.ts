import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || "";
  return proxy(req, `/public/records${qs}`);
}
