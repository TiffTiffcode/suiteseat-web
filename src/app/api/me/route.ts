// src/app/api/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import AuthUser from '@/models/AuthUser';

export async function GET() {
  await connectDB();
  const sid = (await cookies()).get('session')?.value;
  if (!sid) return NextResponse.json({ ok: false, user: null });

  const u = await AuthUser
    .findById(sid)
    .select('_id firstName email role roles')
    .lean<{ _id: unknown; firstName?: string; email?: string; role?: string; roles?: string[] }>();

  if (!u) return NextResponse.json({ ok: false, user: null });

  const role = u.role || (u.roles?.[0]) || 'pro';
  const { _id, ...rest } = u;

  return NextResponse.json({ ok: true, user: { id: String(_id), ...rest, role } });
}
