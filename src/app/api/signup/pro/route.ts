// src/app/api/signup/pro/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import AuthUser from '@/models/AuthUser';

export async function POST(req: NextRequest) {
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const {
    firstName = '',
    lastName = '',
    email = '',
    password = '',
    phone = '',
  } = body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  const normEmail = String(email).trim().toLowerCase();
  const normPassword = String(password);

  if (!normEmail || !normPassword) {
    return NextResponse.json(
      { ok: false, error: 'Missing email or password' },
      { status: 400 }
    );
  }

  const existing = await AuthUser.findOne({ email: normEmail }).lean();
  if (existing) {
    return NextResponse.json(
      { ok: false, error: 'Email already in use' },
      { status: 409 }
    );
  }

  // ✅ always store in passwordHash
  const passwordHash = await bcrypt.hash(normPassword, 10);

  const doc = await AuthUser.create({
    email: normEmail,
    firstName,
    lastName,
    phone,
    passwordHash,
    role: 'pro',
  });

  // ✅ set cookie on the response (Next 16 way)
  const res = NextResponse.json({
    ok: true,
    user: {
      id: String(doc._id),
      firstName: doc.firstName || '',
      lastName: doc.lastName || '',
      email: doc.email,
      role: doc.role || 'pro',
    },
  });

  res.cookies.set('session', String(doc._id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}
