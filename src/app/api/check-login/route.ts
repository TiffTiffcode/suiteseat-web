//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\api\check-login\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import AuthUser from '@/models/AuthUser';

export async function GET(req: NextRequest) {
  await connectDB();

  const sessionId = req.cookies.get('session')?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: true, user: null });
  }

  const user = await AuthUser.findById(sessionId)
    .select('_id email firstName lastName role roles')
    .lean();

  if (!user) {
    return NextResponse.json({ ok: true, user: null });
  }

  const role = user.role || user.roles?.[0] || 'pro';

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      firstName: user.firstName || '',
      email: user.email,
      role,
    },
  });
}
