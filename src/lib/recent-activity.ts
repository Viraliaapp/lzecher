import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { ACTIVITY_TRACKS, type ActivityEvent } from "./activity-events";

const validId = (id: unknown): id is string => typeof id === "string" && !!id && !id.includes("/");
type Claim = { id: string; data: DocumentData };

/** Expand bounded bulk reservations before counting: the newest 80 documents
 * can contain only part of a 525-chapter reservation. Children remain the source
 * of truth after participant edits/deletions; parent summaries can be stale. */
export async function getRecentActivity(db: Firestore, now = Date.now()): Promise<ActivityEvent[]> {
  const snap = await db.collection("lzecher_claims")
    .orderBy("claimedAt", "desc").limit(80).get();
  const reservations = new Map<string, Claim>();
  for (const doc of snap.docs) {
    const c = doc.data();
    if (!validId(c.projectId) || !Number.isFinite(c.claimedAt) || c.claimedAt > now + 60000) continue;
    const parentId = c.isParent === true ? doc.id : c.parentClaimId;
    const key = validId(parentId) ? `parent:${parentId}` : `claim:${doc.id}`;
    if (!reservations.has(key)) reservations.set(key, { id: doc.id, data: c });
    if (reservations.size === 20) break;
  }
  const groups = new Map<string, { claim: DocumentData; count: number }>();
  let remainingChildReads = 2000;
  for (const [reservation, sample] of reservations) {
    let claims: Claim[] = [sample];
    if (reservation.startsWith("parent:")) {
      if (remainingChildReads === 0) continue;
      const children = await db.collection("lzecher_claims")
        .where("parentClaimId", "==", reservation.slice(7)).limit(remainingChildReads + 1).get();
      // Never publish a knowingly truncated count. Normal Shas reservations have
      // 525 children and multi-selection allows at most 150. Bound expansion for
      // the entire response, rather than allowing 2000 reads for each group.
      if (children.size > remainingChildReads) { remainingChildReads = 0; continue; }
      remainingChildReads -= children.size;
      claims = children.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    }
    for (const { data: c } of claims) {
      if (c.isParent === true || c.projectId !== sample.data.projectId || !ACTIVITY_TRACKS.has(c.trackType) ||
        !Number.isFinite(c.claimedAt) || c.claimedAt > now + 60000 ||
        !["active", "completed"].includes(c.status)) continue;
      const name = typeof c.userName === "string" ? c.userName.trim() : "";
      const key = JSON.stringify([reservation, c.trackType, c.userId || "anonymous", name]);
      const group = groups.get(key);
      if (group) group.count++;
      else groups.set(key, { claim: { ...c, userName: name }, count: 1 });
    }
  }
  const projectIds = [...new Set([...groups.values()].map(g => g.claim.projectId as string))];
  const projects = projectIds.length ? await db.getAll(...projectIds.map(id => db.collection("lzecher_projects").doc(id))) : [];
  const byProject = new Map(projects.filter(p => p.exists).map(p => [p.id, p.data()!]));
  return [...groups.entries()].flatMap(([id, { claim: c, count }]) => {
    const p = byProject.get(c.projectId);
    if (!p) return [];
    return [{ id, name: c.userName || null, count, trackType: c.trackType, projectId: c.projectId,
      honoreeHebrew: `${p.nameHebrew || ""} ${p.familyNameHebrew || ""}`.trim(),
      honoreeHonorific: typeof p.honorific === "string" ? p.honorific : p.gender === "female" ? "ע״ה" : "ז״ל",
      claimedAt: c.claimedAt }];
  }).sort((a, b) => b.claimedAt - a.claimedAt).slice(0, 20);
}
