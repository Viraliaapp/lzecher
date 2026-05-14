// Migration: add 'kabalos' to existing projects that don't have it,
// and seed the kabalos portions (one per MITZVAH_TEMPLATES entry).
const admin = require("firebase-admin");
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env.local") });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// Inline copy of MITZVAH_TEMPLATES (full set in src/lib/seed-data.ts).
// Migration only needs id/title/titleHebrew to seed portions.
const MITZVAH_TEMPLATES = [
  { id: "shabbat-candles", title: "Shabbat Candle Lighting", titleHebrew: "הדלקת נרות" },
  { id: "hafrashat-challah", title: "Hafrashat Challah", titleHebrew: "הפרשת חלה" },
  { id: "tzedakah-daily", title: "Daily Tzedakah", titleHebrew: "צדקה יומית" },
  { id: "mitzvah-kabalah", title: "Mitzvah Acceptance", titleHebrew: "התחייבות מצוה" },
  { id: "chesed-acts", title: "Acts of Chesed", titleHebrew: "חסד" },
  { id: "visit-kever", title: "Visit Kever", titleHebrew: "ביקור קבר" },
  { id: "limud-halacha-yomi", title: "Daily Halacha", titleHebrew: "לימוד הלכה יומי" },
  { id: "brachos-kavana", title: "Brachot with Kavana", titleHebrew: "ברכות בכוונה" },
  { id: "chesed-visit-sick", title: "Bikur Cholim", titleHebrew: "ביקור חולים" },
  { id: "shemiras-halashon", title: "Shemiras Halashon", titleHebrew: "שמירת הלשון" },
  { id: "mussar-daily", title: "Daily Mussar Learning", titleHebrew: "לימוד מוסר יומי" },
];

(async () => {
  const projects = await db.collection("lzecher_projects").get();
  console.log(`Found ${projects.size} projects`);

  for (const projDoc of projects.docs) {
    const data = projDoc.data();
    const tracks = Array.isArray(data.tracks) ? data.tracks : [];
    const hasKabalos = tracks.includes("kabalos");

    // Check if kabalos portions already exist
    const existing = await db
      .collection("lzecher_portions")
      .where("projectId", "==", projDoc.id)
      .where("trackType", "==", "kabalos")
      .get();

    if (hasKabalos && existing.size === MITZVAH_TEMPLATES.length) {
      console.log(`✓ ${projDoc.id} (${data.nameHebrew}) — already has kabalos + ${existing.size} portions`);
      continue;
    }

    // Find the highest existing order to append after
    const allPortions = await db
      .collection("lzecher_portions")
      .where("projectId", "==", projDoc.id)
      .get();
    let maxOrder = 0;
    allPortions.forEach((d) => {
      const o = d.data().order || 0;
      if (o > maxOrder) maxOrder = o;
    });

    const batch = db.batch();
    let added = 0;

    if (!hasKabalos) {
      batch.update(projDoc.ref, { tracks: [...tracks, "kabalos"] });
    }

    // Seed kabalos portions if missing
    if (existing.size < MITZVAH_TEMPLATES.length) {
      // Skip templates already present
      const existingIds = new Set(existing.docs.map((d) => d.data().reference));
      let order = maxOrder;
      for (const mt of MITZVAH_TEMPLATES) {
        if (existingIds.has(mt.title)) continue;
        order++;
        const ref = db.collection("lzecher_portions").doc();
        batch.set(ref, {
          id: ref.id,
          projectId: projDoc.id,
          trackType: "kabalos",
          claimMode: "inclusive",
          reference: mt.title,
          displayName: mt.title,
          displayNameHebrew: mt.titleHebrew,
          order,
          status: "available",
          currentClaimerCount: 0,
        });
        added++;
      }
    }

    batch.update(projDoc.ref, {
      totalPortions: (data.totalPortions || allPortions.size) + added,
    });

    await batch.commit();
    console.log(`✓ ${projDoc.id} (${data.nameHebrew}) — added kabalos to tracks + seeded ${added} portions`);
  }

  console.log("\nMigration complete");
  process.exit(0);
})().catch((e) => {
  console.error("Migration FAILED:", e);
  process.exit(1);
});
