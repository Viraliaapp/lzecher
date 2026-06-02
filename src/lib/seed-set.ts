/**
 * Seed a new repeating set for mishnayos or tehillim.
 * Used both at project creation (set 1) and when a set completes (set N+1).
 * Returns number of portions created.
 */
const BATCH_CHUNK = 400; // stay under Firestore 500-op limit

export async function seedSetForTrack(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  trackType: "mishnayos" | "tehillim",
  setNumber: number
): Promise<number> {
  const { MASECHTOS, TEHILLIM } = await import("./seed-data");

  type PortionDoc = Record<string, unknown>;
  const items: { ref: FirebaseFirestore.DocumentReference; data: PortionDoc }[] = [];

  if (trackType === "mishnayos") {
    let order = (setNumber - 1) * 525; // offset order to keep sets sortable
    for (const m of MASECHTOS) {
      for (let p = 1; p <= m.perakim; p++) {
        order++;
        const ref = db.collection("lzecher_portions").doc();
        items.push({
          ref,
          data: {
            id: ref.id,
            projectId,
            trackType: "mishnayos",
            claimMode: "exclusive",
            reference: `${m.name} ${p}`,
            displayName: `${m.name} Chapter ${p}`,
            displayNameHebrew: `${m.nameHebrew} פרק ${p}`,
            order,
            status: "available",
            seder: m.seder,
            masechet: m.name,
            perek: p,
            setNumber,
          },
        });
      }
    }
  } else {
    let order = (setNumber - 1) * 150;
    for (const mz of TEHILLIM) {
      order++;
      const ref = db.collection("lzecher_portions").doc();
      items.push({
        ref,
        data: {
          id: ref.id,
          projectId,
          trackType: "tehillim",
          claimMode: "exclusive",
          reference: `Tehillim ${mz.number}`,
          displayName: `Psalm ${mz.number}`,
          displayNameHebrew: `תהילים ${mz.number}`,
          order,
          status: "available",
          mizmor: mz.number,
          setNumber,
        },
      });
    }
  }

  // Write in chunks of BATCH_CHUNK
  for (let i = 0; i < items.length; i += BATCH_CHUNK) {
    const chunk = items.slice(i, i + BATCH_CHUNK);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.set(ref, data);
    }
    await batch.commit();
  }

  return items.length;
}
