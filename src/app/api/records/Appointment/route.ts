// src/app/api/records/Appointment/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8400").replace(/\/$/, "");
  const res = await fetch(`${base}/records/Appointment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
      cookie: req.headers.get("cookie") ?? ""
    },
    body
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" }
  });
}
