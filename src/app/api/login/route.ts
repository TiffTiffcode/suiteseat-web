// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  "http://localhost:8400"; // fallback for local dev

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // If you later need to forward cookies, we can tweak this,
      // but for now this keeps things simple and buildable.
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/login] proxy error:", err);
    return NextResponse.json(
      { error: "Login proxy failed" },
      { status: 500 }
    );
  }
}
