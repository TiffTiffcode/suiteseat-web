import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
if (!API_BASE) console.warn("NEXT_PUBLIC_API_BASE_URL not set");

function rewriteCookie(v: string, isHttps: boolean) {
  let out = v.replace(/;\s*Domain=[^;]+/i, "");
  if (!isHttps) out = out.replace(/;\s*Secure/gi, "");
  return out;
}

type ProxyInit = {
  methodOverride?: string;
  headers?: HeadersInit;
  body?: BodyInit | ReadableStream<Uint8Array> | null;
};

type HeadersWithGetSetCookie = Headers & {
  getSetCookie?: () => string[];
};

export async function proxy(req: NextRequest, path: string, init?: ProxyInit) {
  if (!API_BASE) return NextResponse.json({ error: "API base URL missing" }, { status: 500 });

  const url = `${API_BASE}${path}`;

  const headers = new Headers();
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  } else {
    const accept = req.headers.get("accept");
    const ct = req.headers.get("content-type");
    if (accept) headers.set("accept", accept);
    if (ct) headers.set("content-type", ct);
  }

  const method = init?.methodOverride ?? req.method;

  let body: BodyInit | ReadableStream<Uint8Array> | null | undefined = init?.body;
  if (body === undefined && method !== "GET" && method !== "HEAD") {
    body = req.body as ReadableStream<Uint8Array> | null;
  }

  const upstream = await fetch(url, { method, headers, body, redirect: "manual" });

  const res = new NextResponse(upstream.body, { status: upstream.status });

  const ct = upstream.headers.get("content-type");
  if (ct) res.headers.set("content-type", ct);

  const h = upstream.headers as HeadersWithGetSetCookie;
  if (typeof h.getSetCookie === "function") {
    for (const val of h.getSetCookie()) {
      res.headers.append("set-cookie", rewriteCookie(val, req.nextUrl.protocol === "https:"));
    }
  } else {
    upstream.headers.forEach((val, key) => {
      if (key.toLowerCase() === "set-cookie") {
        res.headers.append("set-cookie", rewriteCookie(val, req.nextUrl.protocol === "https:"));
      }
    });
  }

  return res;
}
