import { completePortion } from "@/lib/claim-completion";
import { ClaimError, claimName } from "@/lib/claim-management";
import { hasProjectAccess } from "@/lib/project-access";
/**
 * POST /api/claims/complete-bulk
 *
 * Bulk-mark caller's active claims as completed. Caller must own the claims.
 * Body: { projectId, scope, scopeId?, idToken?, completedByName? }
 *  - scope: 'masechta' | 'seder' | 'shas' | 'tehillim_book' | 'whole_tehillim'
 *           | 'all_my_claims_in_project' | 'all_my_claims'
 * Returns: { completedCount, alreadyCompletedCount, chizuk, scopeLabel }
 *
 * Rate limit: 5 bulk operations per IP per minute.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { getChizukMessage, type ChizukScenario } from "@/lib/chizuk-messages";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recomputeProjectProgress } from "@/lib/recompute-progress";

type Scope = "masechta" | "seder" | "shas" | "tehillim_book" | "whole_tehillim" | "all_my_claims_in_project" | "all_my_claims";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ClaimError(400, "Invalid completion details");
    const { projectId, scope, scopeId, idToken, completedByName } = body as {
      projectId?: string;
      scope?: Scope;
      scopeId?: string;
      idToken?: string;
      completedByName?: string;
    };

    const scopes = ["masechta", "seder", "shas", "tehillim_book", "whole_tehillim", "all_my_claims_in_project", "all_my_claims"];
    if (!scope || !scopes.includes(scope) ||
      (["masechta", "seder", "tehillim_book"].includes(scope) && (typeof scopeId !== "string" || !scopeId.trim())) ||
      (scope === "tehillim_book" && !["1", "2", "3", "4", "5"].includes(String(scopeId)))) {
      throw new ClaimError(400, "Invalid scope or scope ID");
    }
    if (scope !== "all_my_claims" && !projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    // Identity: prefer authenticated UID, fall back to name match for anon users
    let uid: string | null = null;
    if (idToken) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch { throw new ClaimError(401, "Invalid token; sign in again"); }
    }
    const completerName = completedByName ? claimName(completedByName) : "";
    if (!uid && !completerName) {
      return NextResponse.json({ error: "Sign-in or completedByName required" }, { status: 401 });
    }

    // Rate limit only for anonymous users — authenticated users are not throttled
    if (!uid) {
      const ip = getClientIp(request);
      const rl = await checkRateLimit("bulkCompleteOp", `bulk-complete:${ip}`);
      if (!rl.success) return NextResponse.json({ error: "Too many bulk completions. Try again shortly." }, { status: 429 });
    }

    const db = getAdminDb();
    if (projectId) {
      const projectSnap = await db.collection("lzecher_projects").doc(projectId).get();
      if (!projectSnap.exists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    // Build query for caller's active claims
    let q: FirebaseFirestore.Query = db.collection("lzecher_claims").where("status", "==", "active");
    if (uid) q = q.where("userId", "==", uid);
    else q = q.where("userName", "==", completerName);
    if (projectId) q = q.where("projectId", "==", projectId);

    const snap = await q.get();
    let matching = snap.docs.filter((d) => d.data().isParent !== true);

    // Filter by scope
    if (scope === "masechta" && scopeId) {
      matching = matching.filter((d) => {
        const data = d.data();
        if (data.trackType !== "mishnayos") return false;
        const ref = (data.reference || "") as string;
        return ref.startsWith(scopeId + " ") || ref === scopeId;
      });
    } else if (scope === "seder" && scopeId) {
      // We don't always store seder on the claim; resolve via portion lookup
      const wanted: string[] = [];
      for (const d of matching) {
        const data = d.data();
        if (data.trackType !== "mishnayos") continue;
        if (data.portionId) {
          const portionSnap = await db.collection("lzecher_portions").doc(data.portionId).get();
          const portionData = portionSnap.exists ? portionSnap.data()! : null;
          if (
            portionData &&
            portionData.projectId === data.projectId &&
            portionData.seder === scopeId
          ) {
            wanted.push(d.id);
          }
        }
      }
      matching = matching.filter((d) => wanted.includes(d.id));
    } else if (scope === "shas") {
      matching = matching.filter((d) => d.data().trackType === "mishnayos");
    } else if (scope === "tehillim_book" && scopeId) {
      const ranges: Record<string, [number, number]> = {
        "1": [1, 41], "2": [42, 72], "3": [73, 89], "4": [90, 106], "5": [107, 150],
      };
      const r = ranges[scopeId];
      if (!r) return NextResponse.json({ error: "Invalid tehillim book id" }, { status: 400 });
      matching = matching.filter((d) => {
        if (d.data().trackType !== "tehillim") return false;
        const ref = (d.data().reference || "") as string;
        const n = parseInt(ref.replace(/\D/g, ""), 10);
        return n >= r[0] && n <= r[1];
      });
    } else if (scope === "whole_tehillim") {
      matching = matching.filter((d) => d.data().trackType === "tehillim");
    } else if (scope === "all_my_claims_in_project" || scope === "all_my_claims") {
      // already filtered by project (or not, for all_my_claims)
    }

    if (matching.length === 0) {
      return NextResponse.json({ completedCount: 0, alreadyCompletedCount: 0 });
    }

    const changedProjects = new Set<string>();
    let completedCount = 0;
    for (const doc of matching) {
      const data = doc.data();
      if (!data.projectId || !data.portionId) continue;
      try {
        const changed = await completePortion(db, data.projectId, data.portionId,
          { uid, name: completerName || null }, await hasProjectAccess(data.projectId), doc.id);
        if (changed) { completedCount++; changedProjects.add(data.projectId); }
      } catch (error) {
        // Stale entries must never complete a replacement reservation.
        if (error instanceof ClaimError && [400, 404, 409].includes(error.status)) continue;
        throw error;
      }
    }
    for (const pid of changedProjects) {
      try { await recomputeProjectProgress(db, pid); }
      catch (error) { console.error("[complete-bulk] recompute failed:", error); }
    }

    // Chizuk — pick scenario that matches the bulk operation
    let chizukKey: ChizukScenario;
    if (scope === "shas") chizukKey = "bulk_shas";
    else if (scope === "whole_tehillim") chizukKey = "tehillim_all_complete";
    else if (scope === "seder") chizukKey = "bulk_seder";
    else if (scope === "masechta") chizukKey = "bulk_masechta";
    else chizukKey = "generic_complete";

    const firstPid = matching[0].data().projectId as string;
    const projSnap = await db.collection("lzecher_projects").doc(firstPid).get();
    const honoreeName = projSnap.exists
      ? `${projSnap.data()!.nameHebrew || ""} ${projSnap.data()!.familyNameHebrew || ""}`.trim()
      : "";
    const chizuk = getChizukMessage(chizukKey);
    return NextResponse.json({
      completedCount,
      alreadyCompletedCount: 0,
      chizuk: {
        he: chizuk.he.replace("{name}", honoreeName).replace("{count}", String(completedCount)),
        en: chizuk.en.replace("{name}", honoreeName).replace("{count}", String(completedCount)),
        es: chizuk.es.replace("{name}", honoreeName).replace("{count}", String(completedCount)),
        fr: chizuk.fr.replace("{name}", honoreeName).replace("{count}", String(completedCount)),
      },
    });
  } catch (err) {
    if (err instanceof ClaimError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[complete-bulk] error:", err);
    return NextResponse.json({ error: "Failed to mark complete in bulk" }, { status: 500 });
  }
}
