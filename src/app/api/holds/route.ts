//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\holds\route.ts
// POST /api/holds  -> create a hold {calendarId, dateISO, start, durationMin}
// GET  /api/holds?calendarId=...&dateISO=... -> list active holds for that day
import { NextResponse } from 'next/server';

type Hold = {
  id: string;
  calendarId: string;
  dateISO: string;
  start: string;         // "HH:MM"
  durationMin: number;
  expiresAt: number;     // epoch ms
};

const TTL_MS = 5 * 60 * 1000;

// --- Upstash (if available) ---
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

// --- In-memory fallback (for dev only) ---
const mem = new Map<string, Hold>();

function pruneMem() {
  const now = Date.now();
  for (const [k, v] of mem) if (v.expiresAt <= now) mem.delete(k);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const calendarId = searchParams.get('calendarId') || '';
  const dateISO    = searchParams.get('dateISO')    || '';
  if (!calendarId || !dateISO) return NextResponse.json([], { status: 200 });

  if (hasRedis) {
    // KEYS by prefix; store each hold as JSON at key: hold:{id}, also a set: holds:{calendarId}:{dateISO}
    const keySet = `holds:${calendarId}:${dateISO}`;
    const idsRes = await redisFetch(`/smembers/${keySet}`);
    const ids: string[] = (await idsRes.json()).result || [];
    const now = Date.now();
    const holds: Hold[] = [];
    for (const id of ids) {
      const item = await redisFetch(`/get/hold:${id}`);
      const raw = (await item.json()).result;
      if (!raw) continue;
      const hold = JSON.parse(raw) as Hold;
      if (hold.expiresAt > now) holds.push(hold);
    }
    return NextResponse.json(holds);
  }

  pruneMem();
  const out = [...mem.values()].filter(h => h.calendarId === calendarId && h.dateISO === dateISO);
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Hold>;
  const { calendarId, dateISO, start, durationMin } = body;
  if (!calendarId || !dateISO || !start || !durationMin) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  const hold: Hold = { id, calendarId, dateISO, start, durationMin: Number(durationMin), expiresAt };

  if (hasRedis) {
    const keyItem = `hold:${id}`;
    const keySet  = `holds:${calendarId}:${dateISO}`;
    await redisFetch(`/set/${keyItem}`, {
      method: 'POST',
      body: JSON.stringify({ value: JSON.stringify(hold), ex: TTL_MS / 1000 }), // TTL seconds
    });
    await redisFetch(`/sadd/${keySet}`, { method: 'POST', body: JSON.stringify({ member: id }) });
    return NextResponse.json(hold, { status: 201 });
  }

  mem.set(id, hold);
  return NextResponse.json(hold, { status: 201 });
}
