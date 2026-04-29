import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      idToken,
      nameHebrew,
      nameEnglish,
      fatherNameHebrew,
      motherNameHebrew,
      gender,
      honorific,
      dateOfPassing,
      dateOfPassingHebrew,
      datePreference,
      biography,
      familyMessage,
      isPublic,
      allowAnonymous,
      tracks,
      projectType,
    } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!nameHebrew?.trim() || !nameEnglish?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!tracks || tracks.length === 0) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    // Verify the ID token
    const adminAuth = getAdminAuth();
    let uid: string;
    let email: string | undefined;
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email;
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const db = getAdminDb();
    const slug = slugify(nameEnglish);

    const projectRef = db.collection("lzecher_projects").doc();
    const projectData = {
      id: projectRef.id,
      slug,
      createdBy: uid,
      createdByEmail: email || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nameHebrew: nameHebrew.trim(),
      nameEnglish: nameEnglish.trim(),
      fatherNameHebrew: fatherNameHebrew?.trim() || null,
      motherNameHebrew: motherNameHebrew?.trim() || null,
      gender: gender || "male",
      honorific: honorific || (gender === "female" ? "ע״ה" : "ז״ל"),
      dateOfPassing: dateOfPassing || null,
      dateOfPassingHebrew: dateOfPassingHebrew || null,
      datePreference: datePreference || "both",
      photoURL: null,
      biography: biography?.trim() || null,
      familyMessage: familyMessage?.trim() || null,
      isPublic: isPublic !== false,
      allowAnonymous: allowAnonymous !== false,
      status: "pending_moderation",
      projectType: projectType || "permanent",
      tracks,
      totalPortions: 0,
      claimedPortions: 0,
      completedPortions: 0,
      participantCount: 0,
    };

    await projectRef.set(projectData);

    // Create moderation queue item
    const modRef = db.collection("lzecher_moderation").doc();
    await modRef.set({
      id: modRef.id,
      projectId: projectRef.id,
      projectName: nameEnglish.trim(),
      createdBy: uid,
      createdByEmail: email || null,
      submittedAt: Date.now(),
      status: "pending",
    });

    // Create user doc if it doesn't exist
    const userRef = db.collection("lzecher_users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        id: uid,
        uid,
        email: email || null,
        displayName: null,
        photoURL: null,
        createdAt: Date.now(),
        language: "en",
        totalClaimed: 0,
        totalCompleted: 0,
        projectsCreated: 1,
        projectsContributed: [],
      });
    } else {
      await userRef.update({
        projectsCreated: (userSnap.data()?.projectsCreated || 0) + 1,
      });
    }

    return NextResponse.json({
      success: true,
      projectId: projectRef.id,
      slug,
    });
  } catch (err) {
    console.error("Project creation error:", err);
    return NextResponse.json(
      { error: "Failed to create memorial. Please try again." },
      { status: 500 }
    );
  }
}
