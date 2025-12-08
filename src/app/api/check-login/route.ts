//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\check-login\route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";
export async function GET(req: NextRequest) { return proxy(req, "/check-login"); }
