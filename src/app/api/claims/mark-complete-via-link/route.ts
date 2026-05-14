import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import * as crypto from "crypto";

const SECRET = process.env.REMINDER_ACTION_SECRET || "default-dev-secret";

function verifyToken(token: string): { claimId: string; action: string } | null {
  try {
    const [payloadB64, sigHex] = token.split(".");
    if (!payloadB64 || !sigHex) return null;
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
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

export function generateActionToken(claimId: string, action: string = "mark_complete"): string {
  const payload = {
    claimId,
    action,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const locale = req.nextUrl.searchParams.get("locale") || "en";

  if (!token) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  const verified = verifyToken(token);
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

    if (action === "mark_complete") {
      await claimRef.update({
        status: "completed",
        completedAt: Date.now(),
      });

      // Update portion status if exclusive
      if (claimData.portionId) {
        const portionRef = db.collection("lzecher_portions").doc(claimData.portionId);
        const portionSnap = await portionRef.get();
        if (portionSnap.exists) {
          await portionRef.update({ status: "completed", completedAt: Date.now() });
        }
      }

      // Update project stats
      if (claimData.projectId) {
        const projectRef = db.collection("lzecher_projects").doc(claimData.projectId);
        const projectSnap = await projectRef.get();
        if (projectSnap.exists) {
          const projectData = projectSnap.data()!;
          await projectRef.update({
            completedPortions: (projectData.completedPortions || 0) + 1,
          });
        }
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
