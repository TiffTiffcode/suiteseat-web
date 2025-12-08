// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\records\[type]\[id]\route.ts
import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

const p = (t: string, id: string) =>
  `/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`;

type RecordParams = { type: string; id: string };

export async function GET(
  req: NextRequest,
  context: { params: Promise<RecordParams> }   // ✅ match Next 16 expectation
) {
  const { type, id } = await context.params;   // ✅ await params
  return proxy(req, p(type, id));
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<RecordParams> }   // ✅ same pattern
) {
  const { type, id } = await context.params;
  return proxy(req, p(type, id));
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<RecordParams> }   // ✅ same pattern
) {
  const { type, id } = await context.params;
  return proxy(req, p(type, id));
}
