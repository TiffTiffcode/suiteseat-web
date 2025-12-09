import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import AuthUser from "@/models/AuthUser";

type LeanUser = {
  _id: unknown;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  roles?: string[];
  passwordHash?: string; // new
  password?: string;     // legacy
};

// helper: escape regex from email
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body.email || "").trim();
    const normEmail = rawEmail.toLowerCase();
    const password = String(body.password || "");

    if (!rawEmail || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password required" },
        { status: 400 }
      );
    }

    // 🔹 Case-insensitive email lookup
    const emailRegex = new RegExp("^" + escapeRegex(normEmail) + "$", "i");
    const user = await AuthUser.findOne({ email: emailRegex })
      .select("_id email firstName lastName role roles passwordHash password")
      .lean<LeanUser>();

    if (!user) {
      // no user for that email
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ---------- PASSWORD CHECK ----------
    const stored = (user.passwordHash || user.password || "").trim();
    let valid = false;

    if (stored.startsWith("$2")) {
      // bcrypt hash
      valid = await bcrypt.compare(password, stored);
    } else if (stored) {
      // legacy plain text
      valid = password === stored;

      // upgrade to bcrypt if it matched
      if (valid) {
        const newHash = await bcrypt.hash(password, 10);
        await AuthUser.updateOne(
          { _id: user._id as any },
          { $set: { passwordHash: newHash }, $unset: { password: "" } }
        );
      }
    }

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ---------- SET SESSION COOKIE ----------
    const cookieStore = await cookies();
    cookieStore.set("session", String(user._id), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const role = user.role || user.roles?.[0] || "pro";

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
