/**
 * POST /api/projects/[id]/update
 *
 * Creator (or admin) can update their own project.
 * Mirrors the admin update endpoint but gates on createdBy === uid or isAdmin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyToken } from "@/lib/auth-roles";
import { MITZVAH_TEMPLATES, PARSHIYOT } from "@/lib/seed-data";
import { hashPassword } from "@/lib/password";
import { seedSetForTrack } from "@/lib/seed-set";
import type { TrackType } from "@/lib/types";

const EDITABLE_FIELDS = new Set([
  "nameHebrew", "familyNameHebrew", "fatherNameHebrew", "motherNameHebrew",
  "nameEnglish", "familyNameEnglish", "gender", "honorific",
  "dateOfPassing", "dateOfPassingHebrew", "dateOfPassingGregorian",
  "dateOfBirth", "dateOfBirthHebrew", "datePreference",
  "biography", "familyMessage", "isPublic", "allowAnonymous",
  "photoURL", "projectType", "completionTargetDate", "completionTargetType",
  "repeatingSetEnabled", "showLeaderboard",
  // password protection + attribution + admin display
  "startedByText", "startedByVisible", "announcement", "locked", "customDedication",
]);

const VALID_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos", "daf_yomi"];
const BATCH_CHUNK = 400;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { updates, trackChanges, idToken, password } = body as {
      updates?: Record<string, unknown>;
      trackChanges?: { add?: TrackType[]; remove?: TrackType[]; confirmDestructive?: string };
      idToken?: string;
      password?: string | null; // non-empty = set/change; "" or null = remove
    };

    if (!idToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let decoded: Awaited<ReturnType<typeof verifyToken>>;
    try {
      decoded = await verifyToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }
    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(id);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const currentData = projectSnap.data()!;

    // Authorization: creator OR admin
    const isAdmin = decoded.isAdmin || decoded.isSuperAdmin;
    if (decoded.uid !== currentData.createdBy && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: not the project creator" }, { status: 403 });
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const ops: string[] = [];
    const cleanedUpdates: Record<string, unknown> = {};

    if (updates && typeof updates === "object") {
      for (const [key, value] of Object.entries(updates)) {
        if (!EDITABLE_FIELDS.has(key)) {
          return NextResponse.json({ error: `Field ${key} not editable` }, { status: 400 });
        }
        if (currentData[key] !== value) {
          before[key] = currentData[key];
          after[key] = value;
          cleanedUpdates[key] = value;
        }
      }
    }
    if (Object.keys(cleanedUpdates).length > 0) {
      ops.push(`update_fields:${Object.keys(cleanedUpdates).join(",")}`);
    }

    // Password set/change/remove — hashed, handled separately from plain fields.
    if (password !== undefined) {
      const pw = typeof password === "string" ? password.trim() : "";
      if (pw) {
        const { passwordHash, passwordSalt } = hashPassword(pw);
        cleanedUpdates.passwordHash = passwordHash;
        cleanedUpdates.passwordSalt = passwordSalt;
        ops.push("set_password");
      } else {
        cleanedUpdates.passwordHash = null;
        cleanedUpdates.passwordSalt = null;
        ops.push("remove_password");
      }
    }

    // Stamp announcement time when an announcement is (re)set.
    if (typeof cleanedUpdates.announcement === "string" && cleanedUpdates.announcement.trim()) {
      cleanedUpdates.announcementAt = Date.now();
    }

    let newTracks: TrackType[] = Array.isArray(currentData.tracks) ? [...currentData.tracks] : [];
    let totalPortionsDelta = 0;
    const trackOps: string[] = [];

    if (trackChanges?.add) {
      for (const track of trackChanges.add) {
        if (!VALID_TRACKS.includes(track) || newTracks.includes(track)) continue;
        newTracks.push(track);
        const added = await seedPortionsForTrack(db, id, track);
        totalPortionsDelta += added;
        trackOps.push(`add_track:${track}(+${added}portions)`);
      }
    }

    if (trackChanges?.remove) {
      for (const track of trackChanges.remove) {
        if (!newTracks.includes(track)) continue;
        const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).where("trackType", "==", track).get();
        const claimsSnap = await db.collection("lzecher_claims").where("projectId", "==", id).where("trackType", "==", track).get();
        const hasClaims = claimsSnap.docs.some(d => ["active", "completed"].includes(d.data().status));
        if (hasClaims) {
          if (trackChanges.confirmDestructive !== id) {
            return NextResponse.json({
              error: "Track has participant entries. Pass trackChanges.confirmDestructive=<projectId> to confirm.",
              hasClaims: true,
              activeCount: claimsSnap.docs.filter(d => d.data().status === "active").length,
              completedCount: claimsSnap.docs.filter(d => d.data().status === "completed").length,
            }, { status: 409 });
          }
          await deleteDocsInChunks(db, [...claimsSnap.docs, ...portionsSnap.docs]);
          const claimIds = claimsSnap.docs.map(d => d.id);
          const pendingEmails = await db.collection("lzecher_scheduled_emails").where("projectId", "==", id).where("status", "==", "pending").get();
          const claimIdSet = new Set(claimIds);
          await updateDocsInChunks(
            db,
            pendingEmails.docs.filter((e) => claimIdSet.has(e.data().claimId)),
            { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "track_removed" }
          ).catch(() => {});
          totalPortionsDelta -= portionsSnap.size;
          trackOps.push(`destructive_remove_track:${track}(-${portionsSnap.size}portions,-${claimsSnap.size}claims)`);
        } else {
          await deleteDocsInChunks(db, portionsSnap.docs);
          totalPortionsDelta -= portionsSnap.size;
          trackOps.push(`remove_track:${track}(-${portionsSnap.size}portions)`);
        }
        newTracks = newTracks.filter(t => t !== track);
      }
    }

    if (trackOps.length > 0) {
      cleanedUpdates.tracks = newTracks;
      before.tracks = currentData.tracks;
      after.tracks = newTracks;
      ops.push(...trackOps);
      if (totalPortionsDelta !== 0) {
        cleanedUpdates.totalPortions = (currentData.totalPortions || 0) + totalPortionsDelta;
      }
    }

    if (Object.keys(cleanedUpdates).length === 0) {
      return NextResponse.json({ success: true, noChanges: true });
    }

    cleanedUpdates.updatedAt = Date.now();
    cleanedUpdates.updatedBy = decoded.uid;
    await projectRef.update(cleanedUpdates);

    await db.collection("lzecher_admin_audit").add({
      action: "creator_update_project",
      projectId: id,
      adminUid: decoded.uid,
      timestamp: Date.now(),
      ops,
      before,
      after,
    });

    return NextResponse.json({ success: true, ops, updated: Object.keys(cleanedUpdates) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message.startsWith("FORBIDDEN:")) return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    console.error("[projects/update]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function deleteDocsInChunks(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
}

async function updateDocsInChunks(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
) {
  for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + BATCH_CHUNK)) batch.update(d.ref, updates);
    await batch.commit();
  }
}

async function seedPortionsForTrack(db: FirebaseFirestore.Firestore, projectId: string, track: TrackType): Promise<number> {
  if (track === "mishnayos" || track === "tehillim") {
    const existing = await db
      .collection("lzecher_portions")
      .where("projectId", "==", projectId)
      .where("trackType", "==", track)
      .limit(1)
      .get();
    if (!existing.empty) return 0;
    return seedSetForTrack(db, projectId, track, 1);
  }

  const allP = await db.collection("lzecher_portions").where("projectId", "==", projectId).get();
  let maxOrder = 0;
  allP.forEach(d => { const o = d.data().order || 0; if (o > maxOrder) maxOrder = o; });

  if (track === "shnayim_mikra") {
    const batch = db.batch();
    let added = 0;
    for (const p of PARSHIYOT) {
      maxOrder++;
      const ref = db.collection("lzecher_portions").doc();
      batch.set(ref, {
        id: ref.id,
        projectId,
        trackType: "shnayim_mikra",
        claimMode: "inclusive",
        reference: `Parshas ${p.name}`,
        displayName: `Parshas ${p.name}`,
        displayNameHebrew: `פרשת ${p.nameHebrew}`,
        order: maxOrder,
        status: "available",
        parsha: p.name,
        currentClaimerCount: 0,
      });
      added++;
    }
    await batch.commit();
    return added;
  }

  if (track === "kabalos") {
    const batch = db.batch();
    let added = 0;
    const FEMININE_KABALOS = new Set(["shabbat-candles", "hafrashat-challah"]);
    for (const mt of MITZVAH_TEMPLATES) {
      maxOrder++;
      const ref = db.collection("lzecher_portions").doc();
      batch.set(ref, { id: ref.id, projectId, trackType: "kabalos", claimMode: "inclusive", reference: mt.title, displayName: mt.title, displayNameHebrew: mt.titleHebrew, order: maxOrder, status: "available", currentClaimerCount: 0, claimVerbForm: FEMININE_KABALOS.has(mt.id) ? "feminine" : "both" });
      added++;
    }
    await batch.commit();
    return added;
  }
  if (track === "daf_yomi") {
    const ref = db.collection("lzecher_portions").doc();
    await ref.set({ id: ref.id, projectId, trackType: "daf_yomi", claimMode: "inclusive", reference: "Daf Yomi commitment", displayName: "Daf Yomi", displayNameHebrew: "דף יומי", order: maxOrder + 1, status: "available", currentClaimerCount: 0 });
    return 1;
  }
  return 0;
}
