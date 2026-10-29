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
  const existing = await db.collection("lzecher_portions").where("projectId", "==", projectId)
    .where("trackType", "==", trackType).get();
  const existingReferences = new Set(existing.docs.filter(d => (d.data().setNumber || 1) === setNumber)
    .map(d => d.data().reference));

  if (trackType === "mishnayos") {
    let order = (setNumber - 1) * 525; // offset order to keep sets sortable
    for (const m of MASECHTOS) {
      for (let p = 1; p <= m.perakim; p++) {
        order++;
        const reference = `${m.name} ${p}`;
        if (existingReferences.has(reference)) continue;
        const ref = db.collection("lzecher_portions").doc(`${projectId}_${trackType}_${setNumber}_${order}`);
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
      if (existingReferences.has(`Tehillim ${mz.number}`)) continue;
      const ref = db.collection("lzecher_portions").doc(`${projectId}_${trackType}_${setNumber}_${order}`);
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

  // Stable IDs plus transaction reads make concurrent/partial retries safe.
  let created = 0;
  for (let i = 0; i < items.length; i += BATCH_CHUNK) {
    const chunk = items.slice(i, i + BATCH_CHUNK);
    created += await db.runTransaction(async tx => {
      const project = await tx.get(db.collection("lzecher_projects").doc(projectId));
      if (project.data()?.maintenanceLock || project.data()?.status === "deleted") throw new Error("Project recovery is in progress");
      const snapshots = await tx.getAll(...chunk.map(item => item.ref));
      let count = 0;
      for (let j = 0; j < chunk.length; j++) {
        if (!snapshots[j].exists) { tx.set(chunk[j].ref, chunk[j].data); count++; }
      }
      return count;
    });
  }

  return created;
}
