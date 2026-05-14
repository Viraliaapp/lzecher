// Mints a Firebase custom token from a valid auto_signin signed token.
// Used by the /[locale]/auto-signin page to one-click sign in via email link.
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { verifyToken } from "@/lib/signed-tokens";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "missing token" }, { status: 400 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.purpose !== "auto_signin" || !payload.email) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const email = payload.email.toLowerCase().trim();

    // Look up or create user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      // Create user if doesn't exist
      userRecord = await auth.createUser({
        email,
        emailVerified: true, // proven by clicking signed link from their inbox
      });
    }

    // Ensure Firestore user doc exists
    const userRef = db.collection("lzecher_users").doc(userRecord.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        id: userRecord.uid,
        uid: userRecord.uid,
        email,
        displayName: null,
        photoURL: null,
        createdAt: Date.now(),
        language: payload.locale || "en",
        totalClaimed: 0,
        totalCompleted: 0,
        projectsCreated: 0,
        projectsContributed: [],
      });
    }

    const customToken = await auth.createCustomToken(userRecord.uid);
    return NextResponse.json({
      customToken,
      redirect: payload.redirect || `/${payload.locale || "en"}/dashboard`,
    });
  } catch (err) {
    console.error("[custom-token] error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
