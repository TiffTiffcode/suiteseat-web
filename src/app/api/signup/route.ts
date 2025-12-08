import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import AuthUser from '@/models/AuthUser';

export async function POST(req: NextRequest) {
  await connectDB();
  const { firstName, lastName, email, password, phone } = await req.json();
  const existing = await AuthUser.findOne({ email }).lean();
  if (existing) return NextResponse.json({ ok:false, error:'Email already in use' }, { status:409 });
  const hash = await bcrypt.hash(password, 10);
  const doc = await AuthUser.create({ firstName, lastName, email, password: hash, role: 'client' });
  const cookieStore = await cookies();
  cookieStore.set('session', String(doc._id), { httpOnly:true, path:'/', maxAge:60*60*24*7, sameSite:'lax' });
  return NextResponse.json({ ok:true, user:{ id:String(doc._id), firstName, lastName, email, role:'client' } });
}
