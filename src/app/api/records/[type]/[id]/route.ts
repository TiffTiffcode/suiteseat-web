// src/app/api/records/[type]/[id]/route.ts
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ type: string; id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { type, id } = await ctx.params; // 👈 await
  // ... your logic ...
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { type, id } = await ctx.params; // 👈 await
  // ... your logic ...
  return NextResponse.json({ ok: true });
}

// Do the same for POST/PUT/PATCH if present
