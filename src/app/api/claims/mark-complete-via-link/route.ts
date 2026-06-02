import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { verifyToken as verifySignedToken } from "@/lib/signed-tokens";
import { normalizeLocale } from "@/lib/locales";
import * as crypto from "crypto";

const WRITE_CHUNK = 450;

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
    if (sigHex !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    // Check expiry (7 days)
    if (payload.exp && Date.now() > payload.exp) return null;
    return { claimId: payload.claimId, action: payload.action || "mark_complete" };
  } catch {
    return null;
  }
}

function verifyActionToken(token: string): { claimId: string; action: string } | null {
  const signed = verifySignedToken(token);
  if (signed?.purpose === "mark_complete" && signed.claimId) {
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

async function commitWritesInChunks(
  db: FirebaseFirestore.Firestore,
  writes: Array<(batch: FirebaseFirestore.WriteBatch) => void>
) {
  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + WRITE_CHUNK)) write(batch);
    await batch.commit();
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));

  if (!token) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  const verified = verifyActionToken(token);
  if (!verified) {
    // Token expired or invalid — redirect to confirm-complete with error
    return NextResponse.redirect(
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
      return NextResponse.redirect(
        new URL(`/${locale}/confirm-complete?status=not_found`, req.url)
      );
    }

    const claimData = claimSnap.data()!;

    if (claimData.status === "completed") {
      return NextResponse.redirect(
        new URL(`/${locale}/confirm-complete?status=already_complete&name=${encodeURIComponent(claimData.reference || "")}`, req.url)
      );
    }

    if (!claimData.projectId) {
      return NextResponse.redirect(
        new URL(`/${locale}/confirm-complete?status=error`, req.url)
      );
    }
    const projectRef = db.collection("lzecher_projects").doc(claimData.projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.redirect(
        new URL(`/${locale}/confirm-complete?status=not_found`, req.url)
      );
    }

    if (action === "mark_complete") {
      const completedAt = Date.now();
      const completionPatch = {
        status: "completed",
        completedAt,
        completedByName: claimData.userName || null,
        completedByUid: claimData.userId || null,
      };
      let completedPortionsIncrement = 0;

      if (claimData.isParent === true) {
        if (!Array.isArray(claimData.portionIds) || claimData.portionIds.length === 0) {
          return NextResponse.redirect(
            new URL(`/${locale}/confirm-complete?status=error`, req.url)
          );
        }

        const portionIds = [...new Set(
          claimData.portionIds
            .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
            .filter(Boolean)
        )];
        const portionSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
        for (let i = 0; i < portionIds.length; i += 300) {
          const refs = portionIds
            .slice(i, i + 300)
            .map((id) => db.collection("lzecher_portions").doc(id));
          const snaps = await db.getAll(...refs);
          portionSnaps.push(...snaps);
        }

        const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
        for (const portionSnap of portionSnaps) {
          if (!portionSnap.exists) continue;
          const portionData = portionSnap.data()!;
          if (portionData.projectId !== claimData.projectId) {
            return NextResponse.redirect(
              new URL(`/${locale}/confirm-complete?status=error`, req.url)
            );
          }
          if (portionData.status !== "completed") completedPortionsIncrement++;
          writes.push((batch) => batch.update(portionSnap.ref, completionPatch));
        }

        const childClaimsSnap = await db
          .collection("lzecher_claims")
          .where("parentClaimId", "==", claimRef.id)
          .get();
        for (const child of childClaimsSnap.docs) {
          const childData = child.data();
          if (childData.projectId !== claimData.projectId) {
            return NextResponse.redirect(
              new URL(`/${locale}/confirm-complete?status=error`, req.url)
            );
          }
          if (childData.status !== "completed") {
            writes.push((batch) => batch.update(child.ref, completionPatch));
          }
        }

        writes.push((batch) => batch.update(claimRef, completionPatch));
        await commitWritesInChunks(db, writes);
      } else if (claimData.portionId) {
        const portionRef = db.collection("lzecher_portions").doc(claimData.portionId);
        const portionSnap = await portionRef.get();
        if (portionSnap.exists) {
          const portionData = portionSnap.data()!;
          if (portionData.projectId !== claimData.projectId) {
            return NextResponse.redirect(
              new URL(`/${locale}/confirm-complete?status=error`, req.url)
            );
          }
          if (portionData.status !== "completed") completedPortionsIncrement = 1;
        }

        const batch = db.batch();
        if (portionSnap.exists) {
          batch.update(portionRef, completionPatch);
        }
        batch.update(claimRef, completionPatch);
        await batch.commit();
      } else {
        const batch = db.batch();
        batch.update(claimRef, completionPatch);
        await batch.commit();
      }

      // Update project stats
      const projectData = projectSnap.data()!;
      await projectRef.update({
        completedPortions: (projectData.completedPortions || 0) + completedPortionsIncrement,
      });
      try {
        await recomputeProjectProgress(db, claimData.projectId);
      } catch (e) {
        console.error("[mark-complete-via-link] recompute failed:", e);
      }
    } else if (action === "check_in") {
      // Daily check-in for inclusive claims
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      const lastCheckIn = claimData.lastCheckInDate;
      const currentStreak = claimData.currentStreak || 0;
      const longestStreak = claimData.longestStreak || 0;

      let newStreak = 1;
      if (lastCheckIn === today) {
        // Already checked in today
        return NextResponse.redirect(
          new URL(`/${locale}/confirm-complete?status=already_complete&name=${encodeURIComponent(claimData.reference || "")}`, req.url)
        );
      } else if (lastCheckIn) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (lastCheckIn === yesterday) {
          newStreak = currentStreak + 1;
        }
      }

      await claimRef.update({
        lastCheckIn: now,
        lastCheckInDate: today,
        currentStreak: newStreak,
        longestStreak: Math.max(longestStreak, newStreak),
        "progress.completed": (claimData.progress?.completed || 0) + 1,
      });
    }

    return NextResponse.redirect(
      new URL(`/${locale}/confirm-complete?status=success&name=${encodeURIComponent(claimData.reference || "")}`, req.url)
    );
  } catch (err) {
    console.error("Mark complete via link error:", err);
    return NextResponse.redirect(
      new URL(`/${locale}/confirm-complete?status=error`, req.url)
    );
  }
}
