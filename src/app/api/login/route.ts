// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import AuthUser from "@/models/AuthUser";

// Make sure this runs in Node, not Edge
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeanUser = {
  _id: unknown;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  roles?: string[];
  passwordHash?: string;  // stored bcrypt hash
};

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { email = "", password = "" } = await req.json();
    const normEmail = String(email).trim().toLowerCase();

    if (!normEmail || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password required" },
        { status: 400 }
      );
    }

    const user = await AuthUser.findOne({ email: normEmail })
      .select("_id email firstName lastName role roles passwordHash")
      .lean<LeanUser>();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const hash = user.passwordHash || "";
    let valid = false;

    if (hash.startsWith("$2")) {
      // normal bcrypt hash
      valid = await bcrypt.compare(String(password), hash);
    } else if (hash) {
      // optional: legacy plaintext support
      valid = String(password) === hash;
      if (valid) {
        const newHash = await bcrypt.hash(String(password), 10);
        await AuthUser.updateOne(
          { _id: user._id as any },
          { $set: { passwordHash: newHash } }
        );
      }
    }

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // IMPORTANT: cookies() is sync – no `await`
 // AFTER
const cookieStore = await cookies();
cookieStore.set("session", String(user._id), {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});


    const role = user.role || (user.roles?.[0]) || "pro";

    return NextResponse.json({
      ok: true,
      loggedIn: true,
      user: {
        id: String(user._id),
        firstName: user.firstName || "",
        email: user.email || normEmail,
        role,
      },
    });
  } catch (err) {
    console.error("[api/login] error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
