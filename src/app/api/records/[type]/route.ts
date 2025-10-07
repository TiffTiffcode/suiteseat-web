// src/app/api/records/[type]/route.ts
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ type: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { type } = await ctx.params; // 👈 await params
  // ...your logic...
  return NextResponse.json({ ok: true });
}

export async function POST(_req: Request, ctx: Ctx) {
  const { type } = await ctx.params; // 👈 await params
  // ...your logic...
  return NextResponse.json({ ok: true });
}

// Do the same for PUT/PATCH/DELETE here if they exist.
