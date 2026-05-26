const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env.local") });

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

async function count(name) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

(async () => {
  console.log("═══ POST-WIPE VERIFICATION ═══");
  console.log("Should be 0:");
  console.log("  lzecher_projects:        ", await count("lzecher_projects"));
  console.log("  lzecher_portions:        ", await count("lzecher_portions"));
  console.log("  lzecher_claims:          ", await count("lzecher_claims"));
  console.log("  lzecher_reports:         ", await count("lzecher_reports"));
  console.log("  lzecher_feedback:        ", await count("lzecher_feedback"));
  console.log("  lzecher_scheduled_emails:", await count("lzecher_scheduled_emails"));
  console.log("");
  console.log("Should be preserved:");
  console.log("  lzecher_users:           ", await count("lzecher_users"));
  console.log("  lzecher_mitzvot_templates:", await count("lzecher_mitzvot_templates"));
  console.log("  lzecher_admin_audit:     ", await count("lzecher_admin_audit"));
  console.log("  lzecher_mussar_structure:", await count("lzecher_mussar_structure"));
  process.exit(0);
})();
