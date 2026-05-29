import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();
const OLD_IDS = ["6BI0xHWZOZnjucU1eOjB", "U7XW2KixuhycI6mr7Lbs", "vAPdZbMRaka6665lBS65"];
for (const pid of OLD_IDS) {
  const snap = await db.collection("lzecher_claims").where("portionId", "==", pid).get();
  console.log(`portion ${pid}: ${snap.size} claim docs`);
  for (const d of snap.docs) {
    const x = d.data();
    console.log(`   claim ${d.id}: userName="${x.userName || ""}" userEmail="${x.userEmail || ""}" status=${x.status} reference="${x.reference || ""}"`);
  }
}
process.exit(0);
