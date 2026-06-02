import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";
import { sanitizeReminderPreferences } from "@/lib/queue-reminders";

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
    const verified = verifyUnsubscribeToken(token);
    if (!verified || verified.claimId !== claimId) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const sanitized = sanitizeReminderPreferences(reminderPreferences);

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

    const selectedReminderTypes = new Set<string>();
    for (const pref of sanitized) {
      selectedReminderTypes.add(pref);
      selectedReminderTypes.add(pref === "sevenDays" ? "sevenDaysBefore" : pref);
    }
    const pendingSnap = await db
      .collection("lzecher_scheduled_emails")
      .where("claimId", "==", claimId)
      .limit(100)
      .get();

    const batch = db.batch();
    let cancelCount = 0;
    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      if (data.status !== "pending") continue;
      const reminderType = data.reminderType || data.type;
      if (selectedReminderTypes.has(reminderType)) continue;
      batch.update(doc.ref, {
        status: "canceled",
        canceledAt: Date.now(),
      });
      cancelCount++;
    }
    if (cancelCount > 0) await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[unsubscribe] Error:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
