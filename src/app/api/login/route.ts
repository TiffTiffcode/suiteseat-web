//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\login\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
  passwordHash?: string;   // 👈 important
};

export async function POST(req: NextRequest) {
  await connectDB();

  const { email = '', password = '' } = await req.json();
  const normEmail = String(email).trim().toLowerCase();

  // select the fields that actually exist in your collection
  const user = await AuthUser.findOne({ email: normEmail })
    .select('_id email firstName lastName role roles passwordHash')
    .lean<LeanUser>();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  // bcrypt compare against passwordHash
  const hash = user.passwordHash || '';
  let valid = false;

  if (hash.startsWith('$2')) {
    valid = await bcrypt.compare(String(password), hash);
  } else {
    // (optional) legacy plaintext support – remove if not needed
    valid = String(password) === hash;
    if (valid) {
      const newHash = await bcrypt.hash(String(password), 10);
      // upgrade to bcrypt
      await (await import('mongoose')).default.connection
        .collection('authusers')
        .updateOne({ _id: user._id as any }, { $set: { passwordHash: newHash } });
    }
  }

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('session', String(user._id), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7
  });

  // prefer single role, fallback to first role in array
  const role = user.role || (user.roles?.[0]) || 'pro';

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      firstName: user.firstName || '',
      email: user.email || normEmail,
      role
    }
  });
}
