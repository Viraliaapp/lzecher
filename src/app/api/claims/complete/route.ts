import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { completePortion, checkInClaim } from "@/lib/claim-completion";
import { ClaimError, claimName } from "@/lib/claim-management";
import { documentId } from "@/lib/claim-input";
import { hasProjectAccess } from "@/lib/project-access";
import { verifyToken, hasAdminPermission } from "@/lib/auth-roles";
import { getChizukMessage } from "@/lib/chizuk-messages";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recomputeProjectProgress } from "@/lib/recompute-progress";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ClaimError(400, "Invalid completion details");
    const { portionId, projectId, claimId, idToken, checkIn, completedByName, completedByEmail } = body;

    if (!documentId.safeParse(projectId).success || (portionId && !documentId.safeParse(portionId).success) || (claimId && !documentId.safeParse(claimId).success)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!portionId && !claimId) {
      return NextResponse.json({ error: "portionId or claimId is required" }, { status: 400 });
    }

    // Try to authenticate (optional). If no token, this is an anonymous completion.
    let uid: string | null = null;
    let isAdmin = false;
    if (idToken) {
      try {
        const decoded = await verifyToken(idToken);
        uid = decoded.uid;
        isAdmin = hasAdminPermission(decoded, "projects");
      } catch {
        throw new ClaimError(401, "Invalid token; sign in again");
      }
    }

    // Anonymous completion requires a name and is rate-limited per IP.
    if (!uid) {
      const trimmedName = completedByName ? claimName(completedByName) : "";
      if (!trimmedName) {
        return NextResponse.json({ error: "Name required for anonymous completion" }, { status: 400 });
      }
      const ip = getClientIp(request);
      const rl = await checkRateLimit("markCompleteAnon", `complete:${ip}`);
      if (!rl.success) {
        return NextResponse.json(
          { error: "Too many completions from this address. Please try again later." },
          { status: 429 }
        );
      }
    }

    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const projectData = projectSnap.data()!;

    // ── Check-in path (inclusive daily/weekly commitment) ── REQUIRES AUTH
    if (checkIn === true && claimId) {
      if (!uid) {
        return NextResponse.json({ error: "Sign-in required to mark daily learning" }, { status: 401 });
      }
      const result = await checkInClaim(db, projectId, claimId, uid);
      const honoreeNameCheckin = `${projectData.nameHebrew} ${projectData.familyNameHebrew || ""}`.trim();
      const chizukCheckin = getChizukMessage("generic_checkin");
      return NextResponse.json({
        success: true,
        ...result,
        chizuk: {
          he: chizukCheckin.he.replace("{name}", honoreeNameCheckin),
          en: chizukCheckin.en.replace("{name}", honoreeNameCheckin),
          es: chizukCheckin.es.replace("{name}", honoreeNameCheckin),
          fr: chizukCheckin.fr.replace("{name}", honoreeNameCheckin),
        },
      });
    }

    // ── Standard completion path ──
    if (!portionId) {
      return NextResponse.json({ error: "portionId is required for standard completion" }, { status: 400 });
    }

    await completePortion(db, projectId, portionId, {
      uid, isAdmin, name: completedByName ? claimName(completedByName) : null,
      email: typeof completedByEmail === "string" ? completedByEmail.trim() : null,
    }, await hasProjectAccess(projectId), claimId);

    // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
    try {
      await recomputeProjectProgress(db, projectId);
    } catch (e) {
      console.error("[complete] recompute failed:", e);
    }

    // Build chizuk response
    const honoreeName = `${projectData.nameHebrew} ${projectData.familyNameHebrew || ""}`.trim();
    const chizuk = getChizukMessage("generic_complete");
    return NextResponse.json({
      success: true,
      chizuk: {
        he: chizuk.he.replace("{name}", honoreeName),
        en: chizuk.en.replace("{name}", honoreeName),
        es: chizuk.es.replace("{name}", honoreeName),
        fr: chizuk.fr.replace("{name}", honoreeName),
      },
    });
  } catch (err) {
    if (err instanceof ClaimError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Complete error:", err);
    return NextResponse.json({ error: "Failed to mark as complete" }, { status: 500 });
  }
}
