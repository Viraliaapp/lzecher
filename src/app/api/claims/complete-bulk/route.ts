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
const WRITE_CHUNK = 225; // claim update + portion update can be two writes per claim

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, scope, scopeId, idToken, completedByName } = body as {
      projectId?: string;
      scope?: Scope;
      scopeId?: string;
      idToken?: string;
      completedByName?: string;
    };

    if (!scope) return NextResponse.json({ error: "scope required" }, { status: 400 });
    if (scope !== "all_my_claims" && !projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    // Identity: prefer authenticated UID, fall back to name match for anon users
    let uid: string | null = null;
    if (idToken) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch {}
    }
    const completerName = (completedByName || "").trim();
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

    // Build query for caller's active claims
    let q: FirebaseFirestore.Query = db.collection("lzecher_claims").where("status", "==", "active");
    if (uid) q = q.where("userId", "==", uid);
    else q = q.where("userName", "==", completerName);
    if (projectId) q = q.where("projectId", "==", projectId);

    const snap = await q.get();
    let matching = snap.docs;

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
          if (portionSnap.exists && portionSnap.data()!.seder === scopeId) wanted.push(d.id);
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

    const now = Date.now();
    const projectIncrements = new Map<string, number>();

    for (let i = 0; i < matching.length; i += WRITE_CHUNK) {
      const chunk = matching.slice(i, i + WRITE_CHUNK);
      const batch = db.batch();
      const portionUpdates = new Map<string, FirebaseFirestore.DocumentReference>();

      for (const d of chunk) {
        batch.update(d.ref, {
          status: "completed",
          completedAt: now,
          completedByName: completerName || null,
          completedByUid: uid,
        });
        const data = d.data();
        if (data.portionId) portionUpdates.set(data.portionId, db.collection("lzecher_portions").doc(data.portionId));
        const pid = data.projectId as string;
        projectIncrements.set(pid, (projectIncrements.get(pid) || 0) + 1);
      }
      for (const ref of portionUpdates.values()) {
        batch.update(ref, { status: "completed", completedAt: now });
      }
      await batch.commit();
    }

    // Increment project completedPortions counters (one update per project)
    for (const [pid, count] of projectIncrements.entries()) {
      const pref = db.collection("lzecher_projects").doc(pid);
      const psnap = await pref.get();
      if (psnap.exists) {
        await pref.update({ completedPortions: ((psnap.data()!.completedPortions || 0) as number) + count });
      }
      try {
        await recomputeProjectProgress(db, pid);
      } catch (e) {
        console.error("[complete-bulk] recompute failed:", e);
      }
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
      completedCount: matching.length,
      alreadyCompletedCount: 0,
      chizuk: {
        he: chizuk.he.replace("{name}", honoreeName).replace("{count}", String(matching.length)),
        en: chizuk.en.replace("{name}", honoreeName).replace("{count}", String(matching.length)),
        es: chizuk.es.replace("{name}", honoreeName).replace("{count}", String(matching.length)),
        fr: chizuk.fr.replace("{name}", honoreeName).replace("{count}", String(matching.length)),
      },
    });
  } catch (err) {
    console.error("[complete-bulk] error:", err);
    return NextResponse.json({ error: "Failed to mark complete in bulk" }, { status: 500 });
  }
}
