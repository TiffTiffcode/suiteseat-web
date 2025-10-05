import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

function rewriteCookie(v: string, isHttps: boolean) {
  let out = v.replace(/;\s*Domain=[^;]+/i, '');
  if (!isHttps) out = out.replace(/;\s*Secure/ig, '');
  return out;
}

export async function POST(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API base URL missing' }, { status: 500 });
  }

  const body = await req.text();
  const upstream = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body,
    redirect: 'manual',
  });

  const text = await upstream.text();
  const res = new NextResponse(text, { status: upstream.status });

  const ct = upstream.headers.get('content-type');
  if (ct) res.headers.set('content-type', ct);

  const isHttps = req.nextUrl.protocol === 'https:';
  upstream.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      res.headers.append('set-cookie', rewriteCookie(val, isHttps));
    }
  });

  return res;
}
