/**
 * POST /api/admin/projects/[id]/update
 *
 * Partial update for a project. Admin-only. Logs every change to
 * lzecher_admin_audit. Special handling for tracks (add/remove) including
 * the destructive remove-with-claims scenario which requires double-confirm.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth-roles";
import { MITZVAH_TEMPLATES } from "@/lib/seed-data";
import { hashPassword } from "@/lib/password";
import type { TrackType } from "@/lib/types";

const EDITABLE_FIELDS = new Set([
  "nameHebrew",
  "familyNameHebrew",
  "fatherNameHebrew",
  "motherNameHebrew",
  "nameEnglish",
  "familyNameEnglish",
  "gender",
  "honorific",
  "dateOfPassing",
  "dateOfPassingHebrew",
  "dateOfBirth",
  "dateOfBirthHebrew",
  "datePreference",
  "biography",
  "familyMessage",
  "isPublic",
  "allowAnonymous",
  "photoURL",
  "projectType",
  "completionTargetDate",
  "completionTargetType",
  "repeatingSetEnabled",
  "startedByText",
  "startedByVisible",
  "announcement",
  "locked",
  "customDedication",
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
      trackChanges?: {
        add?: TrackType[];
        remove?: TrackType[];
        confirmDestructive?: string; // typed project ID to allow destructive removal
      };
      idToken?: string;
      password?: string | null; // non-empty = set/change; "" or null = remove
    };

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await requireAdmin(idToken);
    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(id);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const currentData = projectSnap.data()!;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const ops: string[] = [];

    // ── Field updates ───────────────────────────────────────────────────────
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
    if (typeof cleanedUpdates.announcement === "string" && cleanedUpdates.announcement.trim()) {
      cleanedUpdates.announcementAt = Date.now();
    }

    // ── Track changes ───────────────────────────────────────────────────────
    let newTracks: TrackType[] = Array.isArray(currentData.tracks) ? [...currentData.tracks] : [];
    let totalPortionsDelta = 0;
    const trackOps: string[] = [];

    if (trackChanges?.add) {
      for (const track of trackChanges.add) {
        if (!VALID_TRACKS.includes(track)) {
          return NextResponse.json({ error: `Invalid track: ${track}` }, { status: 400 });
        }
        if (newTracks.includes(track)) continue;
        newTracks.push(track);
        const added = await seedPortionsForTrack(db, id, track);
        totalPortionsDelta += added;
        trackOps.push(`add_track:${track}(+${added}portions)`);
      }
    }

    if (trackChanges?.remove) {
      for (const track of trackChanges.remove) {
        if (!newTracks.includes(track)) continue;
        const portionsSnap = await db
          .collection("lzecher_portions")
          .where("projectId", "==", id)
          .where("trackType", "==", track)
          .get();
        const claimsSnap = await db
          .collection("lzecher_claims")
          .where("projectId", "==", id)
          .where("trackType", "==", track)
          .get();
        const hasClaims = claimsSnap.docs.some((d) => d.data().status === "active" || d.data().status === "completed");
        if (hasClaims) {
          if (trackChanges.confirmDestructive !== id) {
            return NextResponse.json({
              error: "Track has claims. Pass trackChanges.confirmDestructive=<projectId> to confirm.",
              hasClaims: true,
              activeCount: claimsSnap.docs.filter((d) => d.data().status === "active").length,
              completedCount: claimsSnap.docs.filter((d) => d.data().status === "completed").length,
            }, { status: 409 });
          }
          // Destructive removal — delete all claims + cancel pending emails
          await deleteDocsInChunks(db, [...claimsSnap.docs, ...portionsSnap.docs]);
          // Cancel pending emails for those claims
          const claimIds = claimsSnap.docs.map((d) => d.id);
          const claimIdSet = new Set(claimIds);
          const pendingEmails = await db
            .collection("lzecher_scheduled_emails")
            .where("projectId", "==", id)
            .where("status", "==", "pending")
            .get();
          await updateDocsInChunks(
            db,
            pendingEmails.docs.filter((e) => claimIdSet.has(e.data().claimId)),
            { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "track_removed" }
          ).catch(() => {});
          totalPortionsDelta -= portionsSnap.size;
          trackOps.push(`destructive_remove_track:${track}(-${portionsSnap.size}portions,-${claimsSnap.size}claims)`);
        } else {
          // Safe removal — just delete the portions
          await deleteDocsInChunks(db, portionsSnap.docs);
          totalPortionsDelta -= portionsSnap.size;
          trackOps.push(`remove_track:${track}(-${portionsSnap.size}portions)`);
        }
        newTracks = newTracks.filter((t) => t !== track);
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

    // Audit log
    await db.collection("lzecher_admin_audit").add({
      action: "update_project",
      projectId: id,
      adminUid: decoded.uid,
      timestamp: Date.now(),
      ops,
      before,
      after,
    });

    return NextResponse.json({
      success: true,
      ops,
      updated: Object.keys(cleanedUpdates),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/update] error:", err);
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

async function seedPortionsForTrack(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  track: TrackType
): Promise<number> {
  // Find existing max order for this project
  const allPortions = await db
    .collection("lzecher_portions")
    .where("projectId", "==", projectId)
    .get();
  let maxOrder = 0;
  allPortions.forEach((d) => {
    const o = d.data().order || 0;
    if (o > maxOrder) maxOrder = o;
  });

  const batch = db.batch();
  let added = 0;

  if (track === "kabalos") {
    for (const mt of MITZVAH_TEMPLATES) {
      maxOrder++;
      const ref = db.collection("lzecher_portions").doc();
      batch.set(ref, {
        id: ref.id,
        projectId,
        trackType: "kabalos",
        claimMode: "inclusive",
        reference: mt.title,
        displayName: mt.title,
        displayNameHebrew: mt.titleHebrew,
        order: maxOrder,
        status: "available",
        currentClaimerCount: 0,
      });
      added++;
    }
  } else if (track === "daf_yomi") {
    maxOrder++;
    const ref = db.collection("lzecher_portions").doc();
    batch.set(ref, {
      id: ref.id,
      projectId,
      trackType: "daf_yomi",
      claimMode: "inclusive",
      reference: "Daf Yomi commitment",
      displayName: "Daf Yomi",
      displayNameHebrew: "דף יומי",
      order: maxOrder,
      status: "available",
      currentClaimerCount: 0,
    });
    added = 1;
  } else {
    // mishnayos/tehillim/shnayim_mikra — too much data to re-seed inline.
    // Return 0; admin should re-run the original create flow if needed.
    // (Alternatively call /api/seed/portions; out of scope here.)
    return 0;
  }
  await batch.commit();
  return added;
}
