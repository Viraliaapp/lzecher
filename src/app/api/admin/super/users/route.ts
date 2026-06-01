import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

const VALID_PERMISSIONS = new Set(["projects", "feedback", "users", "reports", "stats", "settings"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      idToken,
      targetEmail,
      targetUid,
      isAdmin,
      isSuperAdmin,
      permissions,
    } = body as {
      idToken?: string;
      targetEmail?: string;
      targetUid?: string;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      permissions?: unknown;
    };

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const email = typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : "";
    const uid = typeof targetUid === "string" ? targetUid.trim() : "";
    if (!email && !uid) {
      return NextResponse.json({ error: "Provide an email or uid" }, { status: 400 });
    }

    const auth = getAdminAuth();
    let userRecord: Awaited<ReturnType<typeof auth.getUser>>;
    try {
      userRecord = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
    } catch (lookupErr) {
      const code = typeof lookupErr === "object" && lookupErr && "code" in lookupErr
        ? String((lookupErr as { code?: unknown }).code)
        : "";
      if (code.includes("user-not-found")) {
        return NextResponse.json({ error: "User not found. Ask them to sign in once, then add them here." }, { status: 404 });
      }
      throw lookupErr;
    }
    const nextSuper = isSuperAdmin === true;
    const nextAdmin = nextSuper || isAdmin === true;
    if (decoded.uid === userRecord.uid && !nextSuper) {
      return NextResponse.json({ error: "You cannot remove your own super-admin access" }, { status: 400 });
    }

    const safePermissions = Array.isArray(permissions)
      ? permissions.filter((permission): permission is string =>
          typeof permission === "string" && VALID_PERMISSIONS.has(permission)
        )
      : [];
    const nextPermissions = nextAdmin ? safePermissions : [];

    const db = getAdminDb();
    const now = Date.now();
    await auth.setCustomUserClaims(userRecord.uid, {
      ...(userRecord.customClaims || {}),
      isAdmin: nextAdmin,
      isSuperAdmin: nextSuper,
      lzecherPermissions: nextPermissions,
    });
    await db.collection("lzecher_users").doc(userRecord.uid).set({
      id: userRecord.uid,
      uid: userRecord.uid,
      email: userRecord.email || email || null,
      displayName: userRecord.displayName || null,
      photoURL: userRecord.photoURL || null,
      isAdmin: nextAdmin,
      isSuperAdmin: nextSuper,
      permissions: nextPermissions,
      updatedAt: now,
      adminUpdatedBy: decoded.uid,
    }, { merge: true });

    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_update_user",
      targetUid: userRecord.uid,
      targetEmail: userRecord.email || email || null,
      adminUid: decoded.uid,
      at: now,
      timestamp: now,
      details: {
        isAdmin: nextAdmin,
        isSuperAdmin: nextSuper,
        permissions: nextPermissions,
      },
      after: {
        isAdmin: nextAdmin,
        isSuperAdmin: nextSuper,
        permissions: nextPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email || email || null,
        displayName: userRecord.displayName || null,
        isAdmin: nextAdmin,
        isSuperAdmin: nextSuper,
        permissions: nextPermissions,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/users]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
