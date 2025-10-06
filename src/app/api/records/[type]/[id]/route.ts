import { NextRequest } from "next/server";
import { proxy } from "@/app/_utils/proxy";

const p = (t: string, id: string) => `/records/${encodeURIComponent(t)}/${encodeURIComponent(id)}`;

export async function GET(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  return proxy(req, p(params.type, params.id));
}
export async function PATCH(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  return proxy(req, p(params.type, params.id));
}
export async function DELETE(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  return proxy(req, p(params.type, params.id));
}
