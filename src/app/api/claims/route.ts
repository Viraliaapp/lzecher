import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portionId, projectId, claimerName, idToken } = body;

    if (!portionId || !projectId || !claimerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate limit
    const ip = getClientIp(request);
    const rl = await checkRateLimit("claimCreateAnon", `claim:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Optional auth (anonymous claims allowed)
    let uid = "anonymous";
    let email: string | null = null;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || null;
      } catch {
        // Invalid token — treat as anonymous
      }
    }

    const db = getAdminDb();

    // Verify portion exists and is available
    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;
    if (portionData.status !== "available") {
      return NextResponse.json({ error: "Portion already claimed" }, { status: 409 });
    }

    // Claim the portion
    const now = Date.now();
    await portionRef.update({
      status: "claimed",
      claimedBy: uid,
      claimedByName: claimerName.trim(),
      claimedAt: now,
    });

    // Create claim record
    const claimRef = db.collection("lzecher_claims").doc();
    await claimRef.set({
      id: claimRef.id,
      projectId,
      portionId,
      trackType: portionData.trackType,
      reference: portionData.reference,
      userId: uid,
      userName: claimerName.trim(),
      userEmail: email,
      claimedAt: now,
      status: "active",
    });

    // Update project stats
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (projectSnap.exists) {
      const proj = projectSnap.data()!;
      await projectRef.update({
        claimedPortions: (proj.claimedPortions || 0) + 1,
        participantCount: (proj.participantCount || 0) + 1,
      });
    }

    return NextResponse.json({ success: true, claimId: claimRef.id });
  } catch (err) {
    console.error("Claim error:", err);
    return NextResponse.json({ error: "Failed to claim portion" }, { status: 500 });
  }
}
