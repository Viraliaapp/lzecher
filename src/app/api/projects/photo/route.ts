import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";

const MAX_PHOTO_BYTES = 750 * 1024;
const VALID_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    const { idToken, projectId, photoUrl, photoData, contentType } = await request.json();

    if (!idToken || !projectId || (!photoUrl && !photoData)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let decoded: Awaited<ReturnType<typeof verifyToken>>;
    try {
      decoded = await verifyToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(projectId).get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data()!;

    // Only allow creator or admin with project permission to upload photo.
    if (projectData.createdBy !== decoded.uid && !hasAdminPermission(decoded, "projects")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    let nextPhotoUrl: string;

    if (typeof photoData === "string" && photoData.trim()) {
      const type = typeof contentType === "string" && VALID_CONTENT_TYPES.has(contentType)
        ? contentType
        : "image/jpeg";
      let bytes: Buffer;
      try {
        bytes = Buffer.from(photoData, "base64");
      } catch {
        return NextResponse.json({ error: "Invalid photo data" }, { status: 400 });
      }
      if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Photo is too large" }, { status: 400 });
      }

      await db.collection("lzecher_project_photos").doc(projectId).set({
        projectId,
        contentType: type,
        data: photoData,
        size: bytes.length,
        updatedAt: Date.now(),
        updatedBy: decoded.uid,
      });
      nextPhotoUrl = `/api/projects/${projectId}/photo-image?v=${Date.now()}`;
    } else if (typeof photoUrl === "string" && photoUrl.trim()) {
      nextPhotoUrl = photoUrl.trim();
    } else {
      return NextResponse.json({ error: "Missing photo" }, { status: 400 });
    }

    await db.collection("lzecher_projects").doc(projectId).update({
      photoURL: nextPhotoUrl,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true, photoUrl: nextPhotoUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
  }
}
