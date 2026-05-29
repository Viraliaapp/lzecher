import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recomputeProjectProgress } from "@/lib/recompute-progress";

// Max IDs per batch call — covers full Shas (525) plus headroom
const MAX_BATCH_IDS = 600;
// Firestore batch write limit is 500 ops; stay under with headroom
const WRITE_CHUNK = 450;
// Firestore getAll practical limit per call
const GETALL_CHUNK = 300;

export async function POST(request: NextRequest) {
  try {
    const { portionIds, projectId, completedByName, idToken } = await request.json();
    if (!Array.isArray(portionIds) || portionIds.length === 0 || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (portionIds.length > MAX_BATCH_IDS) {
      return NextResponse.json({ error: `Max ${MAX_BATCH_IDS} per batch` }, { status: 400 });
    }

    let uid: string | null = null;
    if (idToken) {
      try {
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch { /* anon */ }
    }

    // Rate limit only for anonymous users — authenticated users are trusted
    if (!uid) {
      const trimmedName = (completedByName || "").trim();
      if (!trimmedName) {
        return NextResponse.json({ error: "Name required for anonymous completion" }, { status: 400 });
      }
      const ip = getClientIp(request);
      // Use bulkCompleteOp: counts this entire batch as ONE action, not N actions
      const rl = await checkRateLimit("bulkCompleteOp", `complete-batch:${ip}`);
      if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const db = getAdminDb();
    const now = Date.now();
    const completerName = (completedByName || "").trim() || null;

    // Fetch all portions in chunks (getAll handles large sets but chunk to be safe)
    const ids = portionIds as string[];
    const allSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    for (let i = 0; i < ids.length; i += GETALL_CHUNK) {
      const chunkRefs = ids.slice(i, i + GETALL_CHUNK).map(id => db.collection("lzecher_portions").doc(id));
      const chunkSnaps = await db.getAll(...chunkRefs);
      allSnaps.push(...chunkSnaps);
    }

    // Batch-write completions in WRITE_CHUNK-sized Firestore batches
    let count = 0;
    for (let i = 0; i < allSnaps.length; i += WRITE_CHUNK) {
      const chunk = allSnaps.slice(i, i + WRITE_CHUNK);
      const batch = db.batch();
      for (const snap of chunk) {
        if (!snap.exists) continue;
        const data = snap.data()!;
        if (data.projectId !== projectId) continue;
        if (data.status !== "claimed") continue;   // only claimed → completed
        if (data.trackType === "kabalos") continue; // kabalos excluded
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

    // Update project completedPortions counter ONCE for the whole batch
    if (count > 0) {
      const projRef = db.collection("lzecher_projects").doc(projectId);
      const projSnap = await projRef.get();
      if (projSnap.exists) {
        await projRef.update({ completedPortions: (projSnap.data()!.completedPortions || 0) + count });
      }
      try {
        await recomputeProjectProgress(db, projectId);
      } catch (e) {
        console.error("[complete-batch] recompute failed:", e);
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error("[complete-batch] error:", err);
    return NextResponse.json({ error: "Failed to mark complete" }, { status: 500 });
  }
}
