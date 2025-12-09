//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\logout\route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // clear the session cookie
  res.cookies.set('session', '', {
    path: '/',
    maxAge: 0,
  });
  return res;
}
