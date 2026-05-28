import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const { portionIds, projectId, completedByName, idToken } = await request.json();
    if (!Array.isArray(portionIds) || portionIds.length === 0 || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (portionIds.length > 200) {
      return NextResponse.json({ error: "Max 200 per batch" }, { status: 400 });
    }

    let uid: string | null = null;
    if (idToken) {
      try {
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch { /* anon */ }
    }

    if (!uid) {
      const trimmedName = (completedByName || "").trim();
      if (!trimmedName) {
        return NextResponse.json({ error: "Name required for anonymous completion" }, { status: 400 });
      }
      const ip = getClientIp(request);
      const rl = await checkRateLimit("markCompleteAnon", `complete-batch:${ip}`);
      if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const db = getAdminDb();
    const now = Date.now();
    const completerName = (completedByName || "").trim() || null;

    // Fetch all portions in one getAll
    const refs = portionIds.map((id: string) => db.collection("lzecher_portions").doc(id));
    const snaps = await db.getAll(...refs);

    let count = 0;
    const BATCH_SIZE = 400;
    for (let i = 0; i < snaps.length; i += BATCH_SIZE) {
      const chunk = snaps.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const snap of chunk) {
        if (!snap.exists) continue;
        const data = snap.data()!;
        if (data.projectId !== projectId) continue;
        if (data.status !== "claimed") continue; // only "claimed" can be completed
        if (data.trackType === "kabalos") continue; // kabalos excluded from completion
        batch.update(snap.ref, {
          status: "completed",
          completedAt: now,
          completedByName: completerName || data.claimedByName || null,
          completedByUid: uid,
        });
        count++;
      }
      await batch.commit();
    }

    // Update project completedPortions counter
    if (count > 0) {
      const projRef = db.collection("lzecher_projects").doc(projectId);
      const projSnap = await projRef.get();
      if (projSnap.exists) {
        await projRef.update({ completedPortions: (projSnap.data()!.completedPortions || 0) + count });
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error("[complete-batch] error:", err);
    return NextResponse.json({ error: "Failed to mark complete" }, { status: 500 });
  }
}
