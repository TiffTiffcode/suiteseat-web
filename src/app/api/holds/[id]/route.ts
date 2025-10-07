// src/app/api/holds/[id]/route.ts
import { NextResponse } from 'next/server';

const url  = process.env.UPSTASH_REDIS_REST_URL;
const token= process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisFetch(path: string, init?: RequestInit) {
  return fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    ...init,
  });
}

const hasRedis = !!(url && token);

type Hold = {
  calendarId: string;
  dateISO: string;
  start?: string;
  durationMin?: number;
  expiresAt?: number;
};

// in-memory fallback for local dev (serverless won't share this anyway)
const mem = new Map<string, Hold>();

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 params is a Promise in Next 15/React 19
) {
  const { id } = await ctx.params;        // 👈 await it

  if (!id) return NextResponse.json({ ok: true });

  if (hasRedis) {
    const get = await redisFetch(`/get/hold:${id}`);
    const raw = (await get.json()).result;

    if (raw) {
      const hold = JSON.parse(raw) as Hold;

      await redisFetch(`/del/hold:${id}`, { method: 'POST' });
      await redisFetch(`/srem/holds:${hold.calendarId}:${hold.dateISO}`, {
        method: 'POST',
        body: JSON.stringify({ member: id }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  mem.delete(id);
  return NextResponse.json({ ok: true });
}
