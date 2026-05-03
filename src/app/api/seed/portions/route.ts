import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { MASECHTOS, TEHILLIM, PARSHIYOT, MITZVAH_TEMPLATES } from "@/lib/seed-data";
import type { TrackType } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { projectId, idToken } = await request.json();

    // Admin-only: verify token and isAdmin claim
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Get project to know which tracks are enabled
    const projectSnap = await adminDb
      .collection("lzecher_projects")
      .doc(projectId)
      .get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectSnap.data()!;
    const tracks = project.tracks as TrackType[];
    let totalPortions = 0;
    const batch = adminDb.batch();
    let batchCount = 0;
    const batches: FirebaseFirestore.WriteBatch[] = [batch];

    function getCurrentBatch() {
      if (batchCount >= 490) {
        const newBatch = adminDb.batch();
        batches.push(newBatch);
        batchCount = 0;
        return newBatch;
      }
      return batches[batches.length - 1];
    }

    let order = 0;

    // Generate Mishnayos portions (by perek)
    if (tracks.includes("mishnayos")) {
      for (const masechet of MASECHTOS) {
        for (let p = 1; p <= masechet.perakim; p++) {
          order++;
          const ref = adminDb.collection("lzecher_portions").doc();
          const currentBatch = getCurrentBatch();
          currentBatch.set(ref, {
            id: ref.id,
            projectId,
            trackType: "mishnayos",
            claimMode: "exclusive",
            reference: `${masechet.name} ${p}`,
            displayName: `${masechet.name} Chapter ${p}`,
            displayNameHebrew: `${masechet.nameHebrew} פרק ${p}`,
            order,
            status: "available",
            seder: masechet.seder,
            masechet: masechet.name,
            perek: p,
          });
          batchCount++;
          totalPortions++;
        }
      }
    }

    // Generate Tehillim portions (by mizmor)
    if (tracks.includes("tehillim")) {
      for (const mizmor of TEHILLIM) {
        order++;
        const ref = adminDb.collection("lzecher_portions").doc();
        const currentBatch = getCurrentBatch();
        currentBatch.set(ref, {
          id: ref.id,
          projectId,
          trackType: "tehillim",
          claimMode: "exclusive",
          reference: `Tehillim ${mizmor.number}`,
          displayName: `Psalm ${mizmor.number}`,
          displayNameHebrew: `תהילים ${mizmor.number}`,
          order,
          status: "available",
          mizmor: mizmor.number,
        });
        batchCount++;
        totalPortions++;
      }
    }

    // Generate Shnayim Mikra portions (by parsha)
    if (tracks.includes("shnayim_mikra")) {
      for (const parsha of PARSHIYOT) {
        order++;
        const ref = adminDb.collection("lzecher_portions").doc();
        const currentBatch = getCurrentBatch();
        currentBatch.set(ref, {
          id: ref.id,
          projectId,
          trackType: "shnayim_mikra",
          claimMode: "inclusive",
          reference: `Parshas ${parsha.name}`,
          displayName: `Parshas ${parsha.name}`,
          displayNameHebrew: `פרשת ${parsha.nameHebrew}`,
          order,
          status: "available",
          parsha: parsha.name,
          currentClaimerCount: 0,
        });
        batchCount++;
        totalPortions++;
      }
    }

    // Generate Mussar portions (one per sefer — inclusive)
    if (tracks.includes("mussar")) {
      const { MUSSAR_SEFORIM } = await import("@/lib/seed-data");
      for (const sefer of MUSSAR_SEFORIM) {
        order++;
        const ref = adminDb.collection("lzecher_portions").doc();
        const currentBatch = getCurrentBatch();
        currentBatch.set(ref, {
          id: ref.id,
          projectId,
          trackType: "mussar",
          claimMode: "inclusive",
          reference: sefer.name,
          displayName: sefer.name,
          displayNameHebrew: sefer.nameHebrew,
          order,
          status: "available",
          currentClaimerCount: 0,
        });
        batchCount++;
        totalPortions++;
      }
    }

    // Generate Kabalos portions (formerly 'mitzvot') — inclusive, one per template
    if (tracks.includes("kabalos") || tracks.includes("mitzvot" as never)) {
      for (const mitzvah of MITZVAH_TEMPLATES) {
        order++;
        const ref = adminDb.collection("lzecher_portions").doc();
        const currentBatch = getCurrentBatch();
        currentBatch.set(ref, {
          id: ref.id,
          projectId,
          trackType: "kabalos",
          claimMode: "inclusive",
          reference: mitzvah.title,
          displayName: mitzvah.title,
          displayNameHebrew: mitzvah.titleHebrew,
          order,
          status: "available",
          currentClaimerCount: 0,
        });
        batchCount++;
        totalPortions++;
      }
    }

    // Generate Daf Yomi portion (single inclusive commitment)
    if (tracks.includes("daf_yomi")) {
      order++;
      const ref = adminDb.collection("lzecher_portions").doc();
      const currentBatch = getCurrentBatch();
      currentBatch.set(ref, {
        id: ref.id,
        projectId,
        trackType: "daf_yomi",
        claimMode: "inclusive",
        reference: "Daf Yomi commitment",
        displayName: "Daf Yomi",
        displayNameHebrew: "דף יומי",
        order,
        status: "available",
        currentClaimerCount: 0,
      });
      batchCount++;
      totalPortions++;
    }

    // Commit all batches
    for (const b of batches) {
      await b.commit();
    }

    // Update project total
    await adminDb.collection("lzecher_projects").doc(projectId).update({
      totalPortions,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      totalPortions,
    });
  } catch (error) {
    console.error("Seed portions error:", error);
    return NextResponse.json(
      { error: "Failed to generate portions" },
      { status: 500 }
    );
  }
}
