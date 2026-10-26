import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { hasProjectAccess } from "@/lib/project-access";
import { ClaimError, claimName } from "@/lib/claim-management";
import { documentId } from "@/lib/claim-input";
import { completePortion } from "@/lib/claim-completion";
import { getClaimMode } from "@/lib/track-config";
import type { TrackType } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !documentId.safeParse(body.projectId).success || !Array.isArray(body.portionIds)
      || !body.portionIds.length || body.portionIds.length > 600
      || !body.portionIds.every((id: unknown) => documentId.safeParse(id).success)) {
      throw new ClaimError(400, "Invalid portion IDs or project ID");
    }
    const { projectId, idToken, completedByName } = body;
    const ids = [...new Set<string>(body.portionIds)];
    let uid: string | null = null;
    if (idToken) {
      const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
      if (!decoded) throw new ClaimError(401, "Invalid token; sign in again");
      uid = decoded.uid;
    }
    const name = completedByName ? claimName(completedByName) : null;
    if (!uid) {
      if (!name) throw new ClaimError(400, "Name required for anonymous completion");
      const rl = await checkRateLimit("bulkCompleteOp", `complete-batch:${getClientIp(request)}`);
      if (!rl.success) throw new ClaimError(429, "Too many requests");
    }
    const db = getAdminDb();
    const access = await hasProjectAccess(projectId);
    const project = await db.collection("lzecher_projects").doc(projectId).get();
    if (!project.exists) throw new ClaimError(404, "Project not found");
    if (project.data()!.passwordHash && !access && project.data()!.createdBy !== uid) {
      throw new ClaimError(403, "Memorial password required");
    }
    let count = 0;
    for (let offset = 0; offset < ids.length; offset += 20) {
      const snaps = await db.getAll(...ids.slice(offset, offset + 20).map(id => db.collection("lzecher_portions").doc(id)));
      const eligible = snaps.filter(s => {
        const p = s.data();
        return p && p.projectId === projectId && ["claimed", "completed"].includes(p.status)
          && (p.claimMode ?? getClaimMode(p.trackType as TrackType)) === "exclusive";
      });
      const completed = await Promise.all(eligible.map(s => completePortion(db, projectId, s.id, { uid, name }, access)));
      count += completed.filter(Boolean).length;
    }
    try { await recomputeProjectProgress(db, projectId); }
    catch (error) { console.error("[complete-batch] recompute failed:", error); }
    return NextResponse.json({ success: true, count });
  } catch (error) {
    if (error instanceof ClaimError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[complete-batch] error:", error);
    return NextResponse.json({ error: "Failed to mark complete" }, { status: 500 });
  }
}
