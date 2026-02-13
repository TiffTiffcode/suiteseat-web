//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\api\records\[...path].js
export const config = {
  api: { bodyParser: false },
};

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN; // https://suiteseat-app1.onrender.com

export default async function handler(req, res) {
  try {
    if (!BACKEND_ORIGIN) {
      return res.status(500).json({ ok: false, error: "BACKEND_ORIGIN env var missing" });
    }

    // Forward: /api/records/<...path>?q -> <BACKEND_ORIGIN>/api/records/<...path>?q
    const pathParts = Array.isArray(req.query.path) ? req.query.path : [];
    const qsIndex = req.url.indexOf("?");
    const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : "";

    const targetUrl = `${BACKEND_ORIGIN}/api/records/${pathParts.join("/")}${qs}`;

    // copy headers + keep cookies
    const headers = { ...req.headers };
    delete headers.host;

    // read raw body
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

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    console.error("[records-proxy] error:", err);
    return res.status(500).json({ ok: false, error: "Records proxy failed" });
  }
}

