import { reserveClaims } from "@/lib/claim-writes";
import { ClaimError } from "@/lib/claim-management";
import { parseClaimInput } from "@/lib/claim-input";
import { hasProjectAccess } from "@/lib/project-access";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeFutureTimestamp, queueRemindersForClaim, sanitizeReminderPreferences } from "@/lib/queue-reminders";
import { maybeOpenNextSet } from "@/lib/open-next-set";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { recomputeGlobalStats } from "@/lib/recompute-global";
import { learningScopeLabel } from "@/lib/learning-label";
import { normalizeEmailAddress } from "@/lib/email-validation";

export async function POST(request: NextRequest) {
  try {
    const body = parseClaimInput(await request.json().catch(() => null));
    const { projectId, scope, scopeId, claimerName, idToken, claimerEmail, reminderPreferences, locale: claimLocale } = body;
    const locale = (typeof claimLocale === "string" && ["en", "he", "es", "fr"].includes(claimLocale)) ? claimLocale : "en";
    const sanitizedReminderPreferences = sanitizeReminderPreferences(reminderPreferences);

    if (!projectId || !scope || !claimerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const scopes = ["shas", "seder", "masechta", "whole_tehillim", "tehillim_book"];
    if (typeof scope !== "string" || !scopes.includes(scope) ||
      (["seder", "masechta", "tehillim_book"].includes(scope) && (typeof scopeId !== "string" || !scopeId.trim())) ||
      (scope === "tehillim_book" && !["1", "2", "3", "4", "5"].includes(String(scopeId)))) {
      throw new ClaimError(400, "Invalid scope or scope ID");
    }
    // Auth first so we can skip rate limit for verified users
    let uid = "anonymous";
    let email: string | null = null;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || null;
      } catch {
        throw new ClaimError(401, "Invalid token; sign in again");
      }
    }

    // Rate limit only for anonymous users
    if (uid === "anonymous") {
      const ip = getClientIp(request);
      const rl = await checkRateLimit("claimCreateAnon", `claim:${ip}`);
      if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
    const submittedEmail = typeof claimerEmail === "string" ? claimerEmail.trim() : "";
    const normalizedSubmittedEmail = normalizeEmailAddress(submittedEmail);
    if (submittedEmail && !normalizedSubmittedEmail && sanitizedReminderPreferences.length > 0) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    email = normalizedSubmittedEmail || normalizeEmailAddress(email);

    const db = getAdminDb();
    const now = Date.now();

    // Reject missing or locked projects before creating any claim documents.
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const lockSnap = await projectRef.get();
    if (!lockSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const projectData = lockSnap.data()!;
    if (projectData.locked === true) {
      return NextResponse.json({ error: "This memorial is locked. No new portions can be taken." }, { status: 423 });
    }
    const reminderEndDate = normalizeFutureTimestamp(projectData.completionTargetDate, now);

    // Build query to find matching portions
    let query = db.collection("lzecher_portions").where("projectId", "==", projectId);

    if (scope === "shas") {
      query = query.where("trackType", "==", "mishnayos");
    } else if (scope === "seder") {
      query = query.where("trackType", "==", "mishnayos").where("seder", "==", scopeId);
    } else if (scope === "masechta") {
      query = query.where("trackType", "==", "mishnayos").where("masechet", "==", scopeId);
    } else if (scope === "whole_tehillim") {
      query = query.where("trackType", "==", "tehillim");
    } else if (scope === "tehillim_book") {
      // Can't filter by book directly in Firestore — we'll filter in JS
      query = query.where("trackType", "==", "tehillim");
    } else {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const portionsSnap = await query.get();
    let portions = portionsSnap.docs;

    // For tehillim_book, filter by book range
    if (scope === "tehillim_book" && scopeId) {
      const bookRanges: Record<string, [number, number]> = {
        "1": [1, 41], "2": [42, 72], "3": [73, 89], "4": [90, 106], "5": [107, 150]
      };
      const range = bookRanges[scopeId];
      if (range) {
        portions = portions.filter(d => {
          const mizmor = d.data().mizmor || 0;
          return mizmor >= range[0] && mizmor <= range[1];
        });
      }
    }

    // Determine claim mode from the first portion
    const firstPortion = portions[0]?.data();
    if (!firstPortion) {
      return NextResponse.json({ error: "No portions found for this scope" }, { status: 404 });
    }
    const claimMode = firstPortion.claimMode || "exclusive";

    // For exclusive: filter to available only
    const availablePortions = claimMode === "exclusive"
      ? portions.filter(d => d.data().status === "available")
      : portions;
    const alreadyTaken = portions.length - availablePortions.length;

    if (availablePortions.length === 0) {
      return NextResponse.json({ error: "All portions already taken", alreadyTaken }, { status: 409 });
    }

    const parentClaimRef = db.collection("lzecher_claims").doc();
    const reserved = await reserveClaims(db, projectId, availablePortions.map(d => d.id), {
      userId: uid, userName: claimerName.trim(), userEmail: email, locale,
      claimedAt: now, status: "active", duration: "oneTime", durationEndDate: reminderEndDate,
      reminderPreferences: sanitizedReminderPreferences,
    }, { access: await hasProjectAccess(projectId), parentId: parentClaimRef.id,
      parent: { trackType: firstPortion.trackType, scope, scopeId: scopeId || scope } });
    const claimedCount = reserved.length;
    if (!claimedCount) return NextResponse.json({ error: "All portions already taken", alreadyTaken: portions.length }, { status: 409 });
    const projectSlug = projectData.slug || null;
    const honoreeName = `${projectData.nameHebrew || ""} ${projectData.familyNameHebrew || ""}`.trim() || undefined;

    // Queue reminders for the parent claim (one set per bulk action, not per child)
    if (email && sanitizedReminderPreferences.length > 0) {
      try {
        await queueRemindersForClaim({
          claimId: parentClaimRef.id,
          projectId,
          projectSlug,
          userId: uid,
          userEmail: email,
          reminderPreferences: sanitizedReminderPreferences,
          durationEndDate: reminderEndDate,
          locale,
          honoreeName,
          commitmentDesc: learningScopeLabel(
            locale,
            scope,
            scopeId,
            firstPortion.trackType,
            claimedCount
          ),
          trackType: firstPortion.trackType,
        });
      } catch (e) {
        console.error("[bulk-claim] queue reminders failed:", e);
      }
    }

    // ── Repeating sets: check if this bulk claim completed a set ─────────────
    try {
      const tt = firstPortion.trackType as "mishnayos" | "tehillim";
      if (tt === "mishnayos" || tt === "tehillim") {
        const projSnap2 = await db.collection("lzecher_projects").doc(projectId).get();
        const projData2 = projSnap2.data();
        if (projData2) {
          const sets = new Set(reserved.map(p => Number(p.data.setNumber) || 1));
          const claimedIds = new Set(reserved.map(p => p.id));
          for (const sn of sets) await maybeOpenNextSet(db, projectId, tt, sn, claimedIds, projData2);
        }
      }
    } catch (setErr) {
      console.error("[bulk-claim] set-completion check failed:", setErr);
    }

    // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
    try {
      await recomputeProjectProgress(db, projectId);
      await recomputeGlobalStats(db);
    } catch (e) {
      console.error("[bulk-claim] recompute failed:", e);
    }

    return NextResponse.json({
      success: true,
      parentClaimId: parentClaimRef.id,
      claimedCount,
      alreadyTakenCount: portions.length - claimedCount,
      totalPortions: portions.length,
    });
  } catch (err) {
    if (err instanceof ClaimError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Bulk claim error:", err);
    return NextResponse.json({ error: "Failed to reserve the selected learning" }, { status: 500 });
  }
}
