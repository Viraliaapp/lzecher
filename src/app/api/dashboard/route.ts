import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = getAdminDb();

    // Get user's projects (single-field query, sort in JS)
    const projSnap = await db
      .collection("lzecher_projects")
      .where("createdBy", "==", uid)
      .get();

    const projects = projSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.createdAt as number) || 0) - ((a.createdAt as number) || 0)
      );

    // Get user's claims (single-field query, sort in JS)
    const claimSnap = await db
      .collection("lzecher_claims")
      .where("userId", "==", uid)
      .get();

    const claims = claimSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.claimedAt as number) || 0) - ((a.claimedAt as number) || 0)
      );

    return NextResponse.json({ projects, claims });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
