// src/app/_utils/proxy.ts
import { NextRequest, NextResponse } from "next/server";

let API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "";
if (!API_BASE) {
  console.warn("NEXT_PUBLIC_API_BASE_URL / API_BASE_URL not set");
} else {
  API_BASE = API_BASE.replace(/\/+$/, "");
  console.log("[proxy] API_BASE =", API_BASE);
}

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

type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };

export async function proxy(req: NextRequest, path: string, init?: ProxyInit) {
  if (!API_BASE) {
    return NextResponse.json({ error: "API base URL missing" }, { status: 500 });
  }

  const safePath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${safePath}`;

  // ---- headers to upstream ----
  const headers = new Headers();

  // pass through Accept/Content-Type if present
  const accept = req.headers.get("accept");
  const ct = req.headers.get("content-type");
  if (accept) headers.set("accept", accept);
  if (ct) headers.set("content-type", ct);

  // include any custom headers from caller
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }

  // 🔴 MOST IMPORTANT: forward the browser cookies to upstream
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const method = init?.methodOverride ?? req.method;

  // body (streams need duplex:'half')
  let body: BodyInit | ReadableStream<Uint8Array> | null | undefined = init?.body;
  if (body === undefined && method !== "GET" && method !== "HEAD") {
    body = req.body as ReadableStream<Uint8Array> | null;
  }

  const upstream = await fetch(url, {
    method,
    headers,
    body,
    redirect: "manual",
    ...(body ? { duplex: "half" as const } : {}),
  });

  const res = new NextResponse(upstream.body, { status: upstream.status });

  // content-type passthrough
  const uct = upstream.headers.get("content-type");
  if (uct) res.headers.set("content-type", uct);

  // pass Set-Cookie back to the browser (rewrite Domain/Secure if needed)
  const h = upstream.headers as HeadersWithGetSetCookie;
  const isHttps = req.nextUrl.protocol === "https:";
  if (typeof h.getSetCookie === "function") {
    for (const val of h.getSetCookie()) {
      res.headers.append("set-cookie", rewriteCookie(val, isHttps));
    }
  } else {
    upstream.headers.forEach((val, key) => {
      if (key.toLowerCase() === "set-cookie") {
        res.headers.append("set-cookie", rewriteCookie(val, isHttps));
      }
    });
  }

  return res;
}
