import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";

const FIRESTORE_WRITE_CHUNK = 450;

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  // If text was all non-Latin (e.g., Hebrew), base will be empty
  return base ? `${base}-${suffix}` : `memorial-${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      idToken,
      nameHebrew,
      familyNameHebrew,
      nameEnglish,
      familyNameEnglish,
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
      password,
      startedByText,
      startedByVisible,
    } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!nameHebrew?.trim()) {
      return NextResponse.json({ error: "Hebrew name is required" }, { status: 400 });
    }
    if (!familyNameHebrew?.trim()) {
      return NextResponse.json({ error: "Hebrew family name is required" }, { status: 400 });
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

    // Rate limit: 10 projects per hour per user
    const rl = await checkRateLimit("projectCreate", uid);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const db = getAdminDb();
    const slug = slugify(nameEnglish?.trim() || nameHebrew);

    // Optional password protection (hashed, never stored plaintext)
    const pw = typeof password === "string" ? password.trim() : "";
    const pwFields = pw ? hashPassword(pw) : { passwordHash: null, passwordSalt: null };

    const projectRef = db.collection("lzecher_projects").doc();
    const projectData = {
      id: projectRef.id,
      slug,
      createdBy: uid,
      createdByEmail: email || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nameHebrew: nameHebrew.trim(),
      familyNameHebrew: familyNameHebrew.trim(),
      nameEnglish: nameEnglish?.trim() || null,
      familyNameEnglish: familyNameEnglish?.trim() || null,
      nameSpanish: body.nameSpanish?.trim() || null,
      nameFrench: body.nameFrench?.trim() || null,
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
      isPublic: isPublic !== false, // deprecated; retained for backward-compat
      passwordHash: pwFields.passwordHash,
      passwordSalt: pwFields.passwordSalt,
      startedByText: typeof startedByText === "string" && startedByText.trim() ? startedByText.trim() : null,
      startedByVisible: Boolean(startedByVisible),
      allowAnonymous: allowAnonymous !== false,
      showLeaderboard: true,
      status: "active",
      reportsCount: 0,
      projectType: projectType || "permanent",
      tracks,
      repeatingSetEnabled: true,
      totalSets: 1,
      totalPortions: 0,
      claimedPortions: 0,
      completedPortions: 0,
      participantCount: 0,
    };

    await projectRef.set(projectData);

    // Auto-generate portions for the project.
    // Firestore batches max at 500 writes; Mishnayos alone is 525 portions.
    try {
      const { MASECHTOS, TEHILLIM, PARSHIYOT, MITZVAH_TEMPLATES } = await import("@/lib/seed-data");
      let order = 0;
      let totalPortions = 0;
      let batch = db.batch();
      let batchCount = 0;

      const flushBatch = async () => {
        if (batchCount === 0) return;
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      };

      const setPortion = async (
        ref: FirebaseFirestore.DocumentReference,
        data: FirebaseFirestore.DocumentData
      ) => {
        if (batchCount >= FIRESTORE_WRITE_CHUNK) {
          await flushBatch();
        }
        batch.set(ref, data);
        batchCount++;
      };

      if (tracks.includes("mishnayos")) {
        for (const m of MASECHTOS) {
          for (let p = 1; p <= m.perakim; p++) {
            order++;
            const ref = db.collection("lzecher_portions").doc();
            await setPortion(ref, {
              id: ref.id, projectId: projectRef.id, trackType: "mishnayos",
              claimMode: "exclusive",
              reference: `${m.name} ${p}`, displayName: `${m.name} Chapter ${p}`,
              displayNameHebrew: `${m.nameHebrew} פרק ${p}`,
              order, status: "available", seder: m.seder, masechet: m.name, perek: p,
              setNumber: 1,
            });
            totalPortions++;
          }
        }
      }
      if (tracks.includes("tehillim")) {
        for (const mz of TEHILLIM) {
          order++;
          const ref = db.collection("lzecher_portions").doc();
          await setPortion(ref, {
            id: ref.id, projectId: projectRef.id, trackType: "tehillim",
            claimMode: "exclusive",
            reference: `Tehillim ${mz.number}`, displayName: `Psalm ${mz.number}`,
            displayNameHebrew: `תהלים ${mz.number}`,
            order, status: "available", mizmor: mz.number,
            setNumber: 1,
          });
          totalPortions++;
        }
      }
      if (tracks.includes("shnayim_mikra")) {
        for (const p of PARSHIYOT) {
          order++;
          const ref = db.collection("lzecher_portions").doc();
          await setPortion(ref, {
            id: ref.id, projectId: projectRef.id, trackType: "shnayim_mikra",
            claimMode: "inclusive",
            reference: `Parshas ${p.name}`, displayName: `Parshas ${p.name}`,
            displayNameHebrew: `פרשת ${p.nameHebrew}`,
            order, status: "available", parsha: p.name,
            currentClaimerCount: 0,
          });
          totalPortions++;
        }
      }
      // 'kabalos' track — inclusive, bli neder, one portion per template
      if (tracks.includes("kabalos") || tracks.includes("mitzvot" as never)) {
        for (const mt of MITZVAH_TEMPLATES) {
          order++;
          const ref = db.collection("lzecher_portions").doc();
          await setPortion(ref, {
            id: ref.id, projectId: projectRef.id, trackType: "kabalos",
            claimMode: "inclusive",
            reference: mt.titleHebrew, displayName: mt.title,
            displayNameHebrew: mt.titleHebrew,
            order, status: "available",
            currentClaimerCount: 0,
            claimerNames: [],
            claimVerbForm: "both",
            isFreeText: mt.id === "kabbalah-ishit",
          });
          totalPortions++;
        }
      }
      if (tracks.includes("daf_yomi")) {
        order++;
        const ref = db.collection("lzecher_portions").doc();
        await setPortion(ref, {
          id: ref.id, projectId: projectRef.id, trackType: "daf_yomi",
          claimMode: "inclusive",
          reference: "Daf Yomi commitment",
          displayName: "Daf Yomi",
          displayNameHebrew: "דף יומי",
          order, status: "available",
          currentClaimerCount: 0,
        });
        totalPortions++;
      }

      await flushBatch();
      await projectRef.update({ totalPortions });
    } catch (seedErr) {
      console.error("Auto-seed portions error:", seedErr);
      const orphanedPortions = await db
        .collection("lzecher_portions")
        .where("projectId", "==", projectRef.id)
        .get()
        .catch(() => null);
      if (orphanedPortions) {
        for (let i = 0; i < orphanedPortions.docs.length; i += FIRESTORE_WRITE_CHUNK) {
          const cleanupBatch = db.batch();
          for (const doc of orphanedPortions.docs.slice(i, i + FIRESTORE_WRITE_CHUNK)) {
            cleanupBatch.delete(doc.ref);
          }
          await cleanupBatch.commit().catch(() => {});
        }
      }
      await projectRef.delete().catch(() => {});
      return NextResponse.json(
        { error: "Failed to generate learning portions. Please try again." },
        { status: 500 }
      );
    }

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
