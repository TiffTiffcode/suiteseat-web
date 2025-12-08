//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\logout\route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set('session', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' });
  return NextResponse.json({ ok: true });
}
