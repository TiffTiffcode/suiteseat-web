import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

export async function GET(req: NextRequest) {
  return proxy(req, "/check-login");
}
