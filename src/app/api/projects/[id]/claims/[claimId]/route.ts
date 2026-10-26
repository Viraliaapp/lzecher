import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";
import { ClaimError, claimName, manageClaim } from "@/lib/claim-management";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { recomputeGlobalStats } from "@/lib/recompute-global";

type Context = { params: Promise<{ id: string; claimId: string }> };

async function mutate(request: NextRequest, context: Context, remove: boolean) {
  try {
    const { id: projectId, claimId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ClaimError(400, "Invalid request");
    if (typeof body.idToken !== "string" || !body.idToken) throw new ClaimError(401, "Unauthorized");
    const decoded = await verifyToken(body.idToken).catch(() => {
      throw new ClaimError(401, "Invalid token");
    });
    const db = getAdminDb();
    await manageClaim(db, projectId, claimId, { uid: decoded.uid, isAdmin: hasAdminPermission(decoded, "projects") }, remove
      ? { type: "delete" } : { type: "rename", name: claimName(body.userName) });
    // Renames also change anonymous participant deduplication and the leaderboard.
    try {
      await recomputeProjectProgress(db, projectId);
      await recomputeGlobalStats(db);
    } catch (error) {
      console.error("[manage-claim] stats refresh failed:", error);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClaimError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[manage-claim] error:", error);
    return NextResponse.json({ error: "Could not update learning entry" }, { status: 500 });
  }
}

export function PATCH(request: NextRequest, context: Context) { return mutate(request, context, false); }
export function DELETE(request: NextRequest, context: Context) { return mutate(request, context, true); }
