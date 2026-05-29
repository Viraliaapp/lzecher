/**
 * POST /api/projects/[id]/update
 *
 * Creator (or admin) can update their own project.
 * Mirrors the admin update endpoint but gates on createdBy === uid or isAdmin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyToken } from "@/lib/auth-roles";
import { MITZVAH_TEMPLATES } from "@/lib/seed-data";
import { hashPassword } from "@/lib/password";
import type { TrackType } from "@/lib/types";

const EDITABLE_FIELDS = new Set([
  "nameHebrew", "familyNameHebrew", "fatherNameHebrew", "motherNameHebrew",
  "nameEnglish", "familyNameEnglish", "gender", "honorific",
  "dateOfPassing", "dateOfPassingHebrew", "dateOfPassingGregorian",
  "dateOfBirth", "dateOfBirthHebrew", "datePreference",
  "biography", "familyMessage", "isPublic", "allowAnonymous",
  "photoURL", "projectType", "completionTargetDate", "completionTargetType",
  "repeatingSetEnabled",
  // password protection + attribution + admin display
  "startedByText", "startedByVisible", "announcement", "locked", "customDedication",
]);

const VALID_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos", "daf_yomi"];

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

    const decoded = await verifyToken(idToken);
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
              error: "Track has claims. Pass trackChanges.confirmDestructive=<projectId> to confirm.",
              hasClaims: true,
              activeCount: claimsSnap.docs.filter(d => d.data().status === "active").length,
              completedCount: claimsSnap.docs.filter(d => d.data().status === "completed").length,
            }, { status: 409 });
          }
          const batch = db.batch();
          for (const d of [...claimsSnap.docs, ...portionsSnap.docs]) batch.delete(d.ref);
          await batch.commit();
          const claimIds = claimsSnap.docs.map(d => d.id);
          const pendingEmails = await db.collection("lzecher_scheduled_emails").where("projectId", "==", id).where("status", "==", "pending").get();
          const emailBatch = db.batch();
          for (const e of pendingEmails.docs) {
            if (claimIds.includes(e.data().claimId)) emailBatch.update(e.ref, { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "track_removed" });
          }
          await emailBatch.commit().catch(() => {});
          totalPortionsDelta -= portionsSnap.size;
          trackOps.push(`destructive_remove_track:${track}(-${portionsSnap.size}portions,-${claimsSnap.size}claims)`);
        } else {
          const batch = db.batch();
          for (const d of portionsSnap.docs) batch.delete(d.ref);
          await batch.commit();
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

async function seedPortionsForTrack(db: FirebaseFirestore.Firestore, projectId: string, track: TrackType): Promise<number> {
  if (track === "kabalos") {
    const batch = db.batch();
    let added = 0;
    const allP = await db.collection("lzecher_portions").where("projectId", "==", projectId).get();
    let maxOrder = 0;
    allP.forEach(d => { const o = d.data().order || 0; if (o > maxOrder) maxOrder = o; });
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
    const allP = await db.collection("lzecher_portions").where("projectId", "==", projectId).get();
    let maxOrder = 0;
    allP.forEach(d => { const o = d.data().order || 0; if (o > maxOrder) maxOrder = o; });
    const ref = db.collection("lzecher_portions").doc();
    await ref.set({ id: ref.id, projectId, trackType: "daf_yomi", claimMode: "inclusive", reference: "Daf Yomi commitment", displayName: "Daf Yomi", displayNameHebrew: "דף יומי", order: maxOrder + 1, status: "available", currentClaimerCount: 0 });
    return 1;
  }
  // mishnayos/tehillim/shnayim_mikra — seed via seedSetForTrack or return 0
  return 0;
}
