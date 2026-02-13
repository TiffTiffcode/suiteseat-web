//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\pages\api\records\[...path].js

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  try {
    const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN; // set in Vercel + .env.local
    if (!BACKEND_ORIGIN) {
      return res
        .status(500)
        .json({ ok: false, error: "BACKEND_ORIGIN env var missing" });
    }

    // /api/records/<...path>?q  ->  <BACKEND_ORIGIN>/api/records/<...path>?q
    const pathParts = Array.isArray(req.query.path) ? req.query.path : [];
    const qsIndex = req.url.indexOf("?");
    const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : "";
    const targetUrl = `${BACKEND_ORIGIN}/api/records/${pathParts.join("/")}${qs}`;

    // Copy headers (keep cookies)
    const headers = { ...req.headers };
    delete headers.host;

    // Read raw body (for POST/PATCH/DELETE)
    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // Pass status
    res.status(upstream.status);

    // Pass headers (special handling for set-cookie)
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) res.setHeader("set-cookie", setCookie);

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k === "transfer-encoding") return;
      if (k === "set-cookie") return; // handled above
      res.setHeader(key, value);
    });

    // Return body
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    console.error("[records-proxy] error:", err);
    return res.status(500).json({ ok: false, error: "Records proxy failed" });
  }
}
