import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/signed-tokens";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "missing token" }, { status: 400 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.purpose !== "email_signin" || !payload.email) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
    }
    return NextResponse.json({ email: payload.email, locale: payload.locale || "en" });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
