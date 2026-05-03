import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

// ── HMAC verification (shared logic with cron route) ──────────────────────────

async function verifyUnsubscribeToken(
  token: string
): Promise<{ userId: string; claimId: string } | null> {
  try {
    const [encoded, sigB64] = token.split(".");
    if (!encoded || !sigB64) return null;

    const secret = process.env.CRON_SECRET || "fallback-secret";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Buffer.from(sigB64, "base64url");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(encoded)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    );

    if (payload.exp && Date.now() > payload.exp) return null;

    return { userId: payload.userId, claimId: payload.claimId };
  } catch {
    return null;
  }
}

// ── POST /api/unsubscribe ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { token, claimId, reminderPreferences } = await request.json();

    if (!token || !claimId || !Array.isArray(reminderPreferences)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the HMAC token
    const verified = await verifyUnsubscribeToken(token);
    if (!verified || verified.claimId !== claimId) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Validate preference keys
    const VALID_KEYS = new Set([
      "confirmation",
      "halfway",
      "sevenDaysBefore",
      "threeDaysBefore",
      "oneDayBefore",
      "dailyReminder",
      "weeklyDigest",
    ]);

    const sanitized = (reminderPreferences as string[]).filter((k) =>
      VALID_KEYS.has(k)
    );

    const db = getAdminDb();
    const claimRef = db.collection("lzecher_claims").doc(claimId);
    const claimSnap = await claimRef.get();

    if (!claimSnap.exists) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Security: token user must match claim owner
    const claim = claimSnap.data()!;
    if (claim.userId !== verified.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await claimRef.update({ reminderPreferences: sanitized });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[unsubscribe] Error:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
