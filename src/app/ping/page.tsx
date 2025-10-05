// src/app/ping/page.tsx
export default async function Ping() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  const url = `${base}/api/public/booking-slug/by-business/PUT_BUSINESS_ID_HERE`;

  let ok = false;
  let data: unknown = null;            // use unknown instead of any
  let error: string | null = null;

  try {
    const r = await fetch(url, { cache: 'no-store' });
    ok = r.ok;
    data = await r.json().catch(() => null);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>API Ping</h1>
      <p>BASE: {base}</p>
      <p>URL: {url}</p>
      <pre>{JSON.stringify({ ok, data, error }, null, 2)}</pre>
      <p>Tip: replace PUT_BUSINESS_ID_HERE with a real Business _id when you have one.</p>
    </main>
  );
}
