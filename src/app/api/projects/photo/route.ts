import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { idToken, projectId, photoUrl } = await request.json();

    if (!idToken || !projectId || !photoUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(projectId).get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data()!;

    // Only allow creator or admin to upload photo
    const userRecord = await adminAuth.getUser(uid);
    const isAdmin = userRecord.customClaims?.isAdmin === true;

    if (projectData.createdBy !== uid && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await db.collection("lzecher_projects").doc(projectId).update({
      photoURL: photoUrl,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
  }
}
