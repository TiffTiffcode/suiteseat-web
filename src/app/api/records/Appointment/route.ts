export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/records/Appointment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      cookie: req.headers.get('cookie') ?? ''
    },
    body
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
  });
}
