import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import {
  completionTargetForPurpose,
  normalizeIsoDate,
  normalizeProjectType,
} from "@/lib/project-purpose";
import type { TrackType } from "@/lib/types";

const FIRESTORE_WRITE_CHUNK = 450;
const VALID_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos"];
const VALID_DATE_PREFERENCES = ["hebrew", "gregorian", "both"] as const;
const VALID_LOCALES = ["en", "he", "es", "fr"] as const;
const VALID_GENDERS = ["male", "female"] as const;

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

function textOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function requiredText(value: unknown, maxLength: number): string | null {
  return textOrNull(value, maxLength);
}

function normalizeDatePreference(value: unknown): (typeof VALID_DATE_PREFERENCES)[number] {
  return typeof value === "string" && VALID_DATE_PREFERENCES.includes(value as (typeof VALID_DATE_PREFERENCES)[number])
    ? value as (typeof VALID_DATE_PREFERENCES)[number]
    : "both";
}

function normalizeLocale(value: unknown): (typeof VALID_LOCALES)[number] {
  return typeof value === "string" && VALID_LOCALES.includes(value as (typeof VALID_LOCALES)[number])
    ? value as (typeof VALID_LOCALES)[number]
    : "en";
}

function normalizeGender(value: unknown): (typeof VALID_GENDERS)[number] {
  return typeof value === "string" && VALID_GENDERS.includes(value as (typeof VALID_GENDERS)[number])
    ? value as (typeof VALID_GENDERS)[number]
    : "male";
}

function normalizeTracks(value: unknown): TrackType[] | null {
  if (!Array.isArray(value)) return null;
  const unique = [...new Set(value)];
  if (unique.length === 0) return null;
  if (!unique.every((track): track is TrackType => VALID_TRACKS.includes(track as TrackType))) {
    return null;
  }
  return unique;
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
      shareMessage,
      isPublic,
      tracks,
      projectType,
      password,
      startedByText,
      startedByVisible,
      memorialWallConsent,
      locale,
    } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const nameHebrewClean = requiredText(nameHebrew, 120);
    const familyNameHebrewClean = requiredText(familyNameHebrew, 120);
    if (!nameHebrewClean) {
      return NextResponse.json({ error: "Hebrew name is required" }, { status: 400 });
    }
    if (!familyNameHebrewClean) {
      return NextResponse.json({ error: "Hebrew family name is required" }, { status: 400 });
    }
    const normalizedTracks = normalizeTracks(tracks);
    if (!normalizedTracks) {
      return NextResponse.json(
        { error: "At least one valid track is required" },
        { status: 400 }
      );
    }
    const normalizedProjectType = normalizeProjectType(projectType);
    const normalizedDateOfPassing = normalizeIsoDate(dateOfPassing);
    if (dateOfPassing && !normalizedDateOfPassing) {
      return NextResponse.json({ error: "Invalid date of passing" }, { status: 400 });
    }
    const normalizedDatePreference = normalizeDatePreference(datePreference);
    const normalizedLocale = normalizeLocale(locale);
    const normalizedGender = normalizeGender(gender);
    if (typeof memorialWallConsent !== "boolean") {
      return NextResponse.json({ error: "Memorial wall consent answer is required" }, { status: 400 });
    }
    const nameEnglishClean = textOrNull(nameEnglish, 120);
    const familyNameEnglishClean = textOrNull(familyNameEnglish, 120);
    const fatherNameHebrewClean = textOrNull(fatherNameHebrew, 120);
    const motherNameHebrewClean = textOrNull(motherNameHebrew, 120);
    const honorificClean = textOrNull(honorific, 40) || (normalizedGender === "female" ? "ע״ה" : "ז״ל");
    const biographyClean = textOrNull(biography, 2000);
    const familyMessageClean = textOrNull(familyMessage, 1000);
    const shareMessageClean = textOrNull(shareMessage, 2000);
    const startedByTextClean = textOrNull(startedByText, 160);
    const dateOfPassingHebrewClean = textOrNull(dateOfPassingHebrew, 80);
    const nameSpanishClean = textOrNull(body.nameSpanish, 120);
    const nameFrenchClean = textOrNull(body.nameFrench, 120);

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
    const slug = slugify(nameEnglishClean || nameHebrewClean);

    // Optional password protection (hashed, never stored plaintext)
    const pw = typeof password === "string" ? password.trim() : "";
    if (pw && (pw.length < 3 || pw.length > 128)) {
      return NextResponse.json({ error: "Password must be between 3 and 128 characters" }, { status: 400 });
    }
    const pwFields = pw ? hashPassword(pw) : { passwordHash: null, passwordSalt: null };
    const completionTarget = completionTargetForPurpose(normalizedProjectType, normalizedDateOfPassing);
    const now = Date.now();

    const projectRef = db.collection("lzecher_projects").doc();
    const projectData = {
      id: projectRef.id,
      slug,
      createdBy: uid,
      createdByEmail: email || null,
      createdAt: now,
      updatedAt: now,
      nameHebrew: nameHebrewClean,
      familyNameHebrew: familyNameHebrewClean,
      nameEnglish: nameEnglishClean,
      familyNameEnglish: familyNameEnglishClean,
      nameSpanish: nameSpanishClean,
      nameFrench: nameFrenchClean,
      fatherNameHebrew: fatherNameHebrewClean,
      motherNameHebrew: motherNameHebrewClean,
      gender: normalizedGender,
      honorific: honorificClean,
      dateOfPassing: normalizedDateOfPassing,
      dateOfPassingGregorian: normalizedDateOfPassing,
      dateOfPassingHebrew: dateOfPassingHebrewClean,
      datePreference: normalizedDatePreference,
      photoURL: null,
      biography: biographyClean,
      familyMessage: familyMessageClean,
      shareMessage: shareMessageClean,
      isPublic: isPublic !== false, // deprecated; retained for backward-compat
      passwordHash: pwFields.passwordHash,
      passwordSalt: pwFields.passwordSalt,
      startedByText: startedByTextClean,
      startedByVisible: Boolean(startedByTextClean && startedByVisible),
      memorialWallConsent,
      memorialWallConsentAt: now,
      memorialWallConsentByUid: uid,
      memorialWallConsentByEmail: email || null,
      allowAnonymous: true,
      showLeaderboard: true,
      status: "active",
      reportsCount: 0,
      projectType: normalizedProjectType,
      completionTargetDate: completionTarget.completionTargetDate,
      completionTargetType: completionTarget.completionTargetType,
      tracks: normalizedTracks,
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

      if (normalizedTracks.includes("mishnayos")) {
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
      if (normalizedTracks.includes("tehillim")) {
        for (const mz of TEHILLIM) {
          order++;
          const ref = db.collection("lzecher_portions").doc();
          await setPortion(ref, {
            id: ref.id, projectId: projectRef.id, trackType: "tehillim",
            claimMode: "exclusive",
            reference: `Tehillim ${mz.number}`, displayName: `Psalm ${mz.number}`,
            displayNameHebrew: `תהילים ${mz.number}`,
            order, status: "available", mizmor: mz.number,
            setNumber: 1,
          });
          totalPortions++;
        }
      }
      if (normalizedTracks.includes("shnayim_mikra")) {
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
      if (normalizedTracks.includes("kabalos")) {
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
        language: normalizedLocale,
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
