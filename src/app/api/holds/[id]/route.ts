// DELETE /api/holds/:id -> release a hold
import { NextResponse } from 'next/server';

const url  = process.env.UPSTASH_REDIS_REST_URL;
const token= process.env.UPSTASH_REDIS_REST_TOKEN;
async function redisFetch(path: string, init?: RequestInit) {
  return fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', ...init });
}
const hasRedis = !!(url && token);

// in-memory fallback (same map as other file, but we can’t share easily across files in prod;
// it’s fine for local dev—serverless won’t share memory anyway)
type Hold = { calendarId: string; dateISO: string; start?: string; durationMin?: number; expiresAt?: number };

const mem = new Map<string, Hold>();


export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return NextResponse.json({ ok: true });

  if (hasRedis) {
    const get = await redisFetch(`/get/hold:${id}`);
    const raw = (await get.json()).result;
    if (raw) {
    const hold = JSON.parse(raw) as Hold;

      await redisFetch(`/del/hold:${id}`, { method: 'POST' });
      await redisFetch(`/srem/holds:${hold.calendarId}:${hold.dateISO}`, {
        method: 'POST', body: JSON.stringify({ member: id }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  mem.delete(id);
  return NextResponse.json({ ok: true });
}
