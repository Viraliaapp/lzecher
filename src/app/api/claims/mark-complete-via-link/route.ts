import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { verifyToken as verifySignedToken } from "@/lib/signed-tokens";
import { normalizeLocale } from "@/lib/locales";
import * as crypto from "crypto";

import { completePortion, checkInClaim } from "@/lib/claim-completion";
import { documentId } from "@/lib/claim-input";

function actionSecret(): string {
  const secret = process.env.REMINDER_ACTION_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Missing REMINDER_ACTION_SECRET or CRON_SECRET");
  }
  return secret || "default-dev-secret";
}

function verifyLegacyActionToken(token: string): { claimId: string; action: string } | null {
  try {
    const [payloadB64, sigHex] = token.split(".");
    if (!payloadB64 || !sigHex) return null;
    const expectedSig = crypto
      .createHmac("sha256", actionSecret())
      .update(payloadB64)
      .digest("hex");
    if (sigHex.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sigHex), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.purpose) return null; // Modern signed tokens must match their explicit purpose above.
    // Check expiry (7 days)
    if (typeof payload.exp !== "number" || Date.now() > payload.exp || !documentId.safeParse(payload.claimId).success || !["mark_complete", "check_in"].includes(payload.action || "mark_complete")) return null;
    return { claimId: payload.claimId, action: payload.action || "mark_complete" };
  } catch {
    return null;
  }
}

function verifyActionToken(token: string): { claimId: string; action: string } | null {
  const signed = verifySignedToken(token);
  if (signed?.purpose === "mark_complete" && signed.claimId && documentId.safeParse(signed.claimId).success) {
    return { claimId: signed.claimId, action: "mark_complete" };
  }
  return verifyLegacyActionToken(token);
}

export function generateActionToken(claimId: string, action: string = "mark_complete"): string {
  const payload = {
    claimId,
    action,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", actionSecret()).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

function redirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

// Email previews and security scanners may fetch GET links automatically.
// Only a deliberate form submission may change a learning commitment.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));
  const url = new URL(`/${locale}/confirm-complete`, req.url);
  if (!token || !verifyActionToken(token)) url.searchParams.set("status", "expired");
  else { url.searchParams.set("status", "confirm"); url.searchParams.set("token", token); }
  return redirect(url);
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = form?.get("token");
  const locale = normalizeLocale(form?.get("locale"));
  if (typeof token !== "string") return redirect(new URL(`/${locale}/confirm-complete?status=expired`, req.url));

  if (!token) {
    return redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  const verified = verifyActionToken(token);
  if (!verified) {
    // Token expired or invalid — redirect to confirm-complete with error
    return redirect(
      new URL(`/${locale}/confirm-complete?status=expired`, req.url)
    );
  }

  const { claimId, action } = verified;
  const db = getAdminDb();

  try {
    // Try exclusive claims first
    let claimRef = db.collection("lzecher_claims").doc(claimId);
    let claimSnap = await claimRef.get();

    if (!claimSnap.exists) {
      // Try inclusive claims
      claimRef = db.collection("lzecher_inclusive_claims").doc(claimId);
      claimSnap = await claimRef.get();
    }

    if (!claimSnap.exists) {
      return redirect(
        new URL(`/${locale}/confirm-complete?status=not_found`, req.url)
      );
    }

    const claimData = claimSnap.data()!;

    if (claimData.status === "completed") {
      return redirect(
        new URL(`/${locale}/confirm-complete?status=already_complete&name=${encodeURIComponent(claimData.reference || "")}`, req.url)
      );
    }

    if (!claimData.projectId) {
      return redirect(
        new URL(`/${locale}/confirm-complete?status=error`, req.url)
      );
    }
    const projectRef = db.collection("lzecher_projects").doc(claimData.projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return redirect(
        new URL(`/${locale}/confirm-complete?status=not_found`, req.url)
      );
    }

    if (action === "mark_complete") {
      if (claimData.isParent === true) {
        const children = await db.collection("lzecher_claims")
          .where("parentClaimId", "==", claimRef.id).get();
        for (const child of children.docs) {
          const data = child.data();
          if (data.projectId !== claimData.projectId || !data.portionId) throw new Error("Invalid child learning entry");
          await completePortion(db, data.projectId, data.portionId,
            { uid: claimData.userId || null, name: claimData.userName || null }, true, child.id);
        }
        await claimRef.update({ status: "completed", completedAt: Date.now() });
      } else if (claimData.portionId && claimRef.parent.id === "lzecher_claims") {
        await completePortion(db, claimData.projectId, claimData.portionId,
          { uid: claimData.userId || null, name: claimData.userName || null }, true, claimRef.id);
      } else {
        // Legacy inclusive entries have no exclusive portion to mark complete.
        await claimRef.update({ status: "completed", completedAt: Date.now() });
      }
      try { await recomputeProjectProgress(db, claimData.projectId); }
      catch (error) { console.error("[mark-complete-via-link] recompute failed:", error); }
    } else if (action === "check_in") {
      await checkInClaim(db, claimData.projectId, claimRef.id, claimData.userId,
        Date.now(), claimRef.parent.id === "lzecher_inclusive_claims" ? "lzecher_inclusive_claims" : "lzecher_claims");
    }

    return redirect(
      new URL(`/${locale}/confirm-complete?status=success&name=${encodeURIComponent(claimData.reference || "")}`, req.url)
    );
  } catch (err) {
    console.error("Mark complete via link error:", err);
    return redirect(
      new URL(`/${locale}/confirm-complete?status=error`, req.url)
    );
  }
}
