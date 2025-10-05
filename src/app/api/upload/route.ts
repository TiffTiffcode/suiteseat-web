import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";
export async function POST(req: NextRequest) { return proxy(req, "/upload"); }
