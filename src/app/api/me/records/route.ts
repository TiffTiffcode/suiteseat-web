//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\me\records\route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

// current user's records (your UI calls this)
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || "";
  return proxy(req, `/api/me/records${qs}`);
}
