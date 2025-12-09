// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import AuthUser from '@/models/AuthUser';

type LeanUser = {
  _id: unknown;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  roles?: string[];
  passwordHash?: string;
  password?: string; // legacy
};

export async function POST(req: NextRequest) {
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const { email = '', password = '' } = body as {
    email?: string;
    password?: string;
  };

  const normEmail = String(email).trim().toLowerCase();
  const normPassword = String(password);

  if (!normEmail || !normPassword) {
    return NextResponse.json(
      { ok: false, error: 'Missing email or password' },
      { status: 400 }
    );
  }

  // select all relevant fields
  const user = await AuthUser.findOne({ email: normEmail })
    .select('_id email firstName lastName role roles passwordHash password')
    .lean<LeanUser>();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  let stored = user.passwordHash || user.password || '';
  let valid = false;

  // bcrypt hash always starts with $2...
  if (stored.startsWith('$2')) {
    valid = await bcrypt.compare(normPassword, stored);
  } else if (stored) {
    // legacy plaintext
    valid = normPassword === stored;

    if (valid) {
      // upgrade to bcrypt + passwordHash
      const newHash = await bcrypt.hash(normPassword, 10);
      await AuthUser.updateOne(
        { _id: user._id as any },
        { $set: { passwordHash: newHash }, $unset: { password: '' } }
      );
      stored = newHash;
    }
  }

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  const role = user.role || user.roles?.[0] || 'pro';

  const res = NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      firstName: user.firstName || '',
      email: user.email || normEmail,
      role,
    },
  });

  // ✅ set cookie on the response
  res.cookies.set('session', String(user._id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
