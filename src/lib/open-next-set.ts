/**
 * Checks whether the current repeating set is fully claimed and, if so, seeds the
 * next set. Used by all three claim routes (single, multi, bulk) so the logic is
 * identical everywhere.
 *
 * Safety invariant: a new set is opened ONLY when every single portion in the
 * current set has been claimed/taken (status !== "available") AND the query
 * returned the full expected set size. If either guard fails, we do nothing.
 */
import { seedSetForTrack } from "./seed-set";

// Canonical sizes come from the seed-data itself so they stay in sync.
const EXPECTED_SET_SIZES: Record<string, number> = {
  mishnayos: 525,
  tehillim: 150,
};

export interface OpenNextSetResult {
  newSetOpened: boolean;
  newSetNumber: number | null;
}

/**
 * @param db            Firestore Admin instance
 * @param projectId     The lzecher project
 * @param trackType     "mishnayos" | "tehillim"
 * @param currentSetNumber  The set whose completeness we are checking (1-based)
 * @param excludeIds    Portion IDs that were JUST written in this request's batch
 *                      (may not be reflected in the subsequent query yet)
 * @param projData      The project document snapshot data (for totalPortions / repeatingSetEnabled)
 */
export async function maybeOpenNextSet(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  trackType: "mishnayos" | "tehillim",
  currentSetNumber: number,
  excludeIds: Set<string>,
  projData: FirebaseFirestore.DocumentData
): Promise<OpenNextSetResult> {
  const result: OpenNextSetResult = { newSetOpened: false, newSetNumber: null };

  if (projData.repeatingSetEnabled === false) return result;

  const expectedSize = EXPECTED_SET_SIZES[trackType];
  if (!expectedSize) return result;

  // Fetch every portion for this project+track in a single query.
  // NOTE: Firestore where("setNumber","==",null) does NOT match documents where the
  // field is absent (legacy set-1 portions seeded before setNumber was introduced).
  // We fetch all and filter in memory to treat absent setNumber as set 1.
  const allSnap = await db
    .collection("lzecher_portions")
    .where("projectId", "==", projectId)
    .where("trackType", "==", trackType)
    .get();

  const portionsInCurrentSet = allSnap.docs.filter((d) => {
    const sn = d.data().setNumber;
    return ((sn === undefined || sn === null) ? 1 : sn) === currentSetNumber;
  });

  // Safety guard: if the query returned fewer docs than the full set size, something
  // is wrong (index lag, partial read, etc.). DO NOT seed a new set on incomplete data.
  if (portionsInCurrentSet.length < expectedSize) {
    console.warn(
      `[open-next-set] expected ${expectedSize} portions for set ${currentSetNumber} ` +
        `on project ${projectId}, got ${portionsInCurrentSet.length} — skipping set-open`
    );
    return result;
  }

  // Check whether every portion in the current set has been claimed/taken.
  // excludeIds are portions from the current request whose Firestore update may not
  // yet be visible in the query above — treat them as already claimed.
  const anyStillAvailable = portionsInCurrentSet.some(
    (d) => !excludeIds.has(d.id) && d.data().status === "available"
  );

  if (anyStillAvailable) return result;

  // All portions are claimed/taken. Seed the next set — but only if it doesn't
  // exist yet (idempotency: guards against concurrent requests both seeding).
  const nextSetNumber = currentSetNumber + 1;
  const nextSetAlreadyExists = allSnap.docs.some((d) => {
    const sn = d.data().setNumber;
    return ((sn === undefined || sn === null) ? 1 : sn) === nextSetNumber;
  });

  if (nextSetAlreadyExists) {
    console.log(
      `[open-next-set] set ${nextSetNumber} already exists on ${projectId} — not re-seeding`
    );
    return result;
  }

  const newCount = await seedSetForTrack(db, projectId, trackType, nextSetNumber);
  console.log(
    `[open-next-set] set ${currentSetNumber} complete — seeded set ${nextSetNumber} ` +
      `(${newCount} portions) on project ${projectId}`
  );

  await db
    .collection("lzecher_projects")
    .doc(projectId)
    .update({
      totalPortions: ((projData.totalPortions as number) || 0) + newCount,
      totalSets: nextSetNumber,
      updatedAt: Date.now(),
    });

  result.newSetOpened = true;
  result.newSetNumber = nextSetNumber;
  return result;
}
