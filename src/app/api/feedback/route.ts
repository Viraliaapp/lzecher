import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

const VALID_TYPES = ["suggestion", "bug", "question", "praise", "other"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, email, allowAsTestimonial, locale, currentPath } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }
    if (!message?.trim() || message.length > 2000) {
      return NextResponse.json({ error: "Message required (max 2000 chars)" }, { status: 400 });
    }

    // Rate limit: 5 per IP per hour
    const ip = getClientIp(request);
    const rl = await checkRateLimit("magicLinkPerEmail", `feedback:${ip}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const db = getAdminDb();
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const ref = db.collection("lzecher_feedback").doc();
    await ref.set({
      id: ref.id,
      type,
      message: message.trim().slice(0, 2000),
      email: email || null,
      allowAsTestimonial: allowAsTestimonial === true,
      ipHash,
      locale: locale || "en",
      currentPath: currentPath || null,
      submittedAt: Date.now(),
      status: "new",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
