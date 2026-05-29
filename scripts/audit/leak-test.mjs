import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();
const ps = await db.collection("lzecher_projects").where("slug", "==", "memorial-upvad8").limit(1).get();
const p = ps.docs[0].data();
// Print this project's PROJECT-SPECIFIC data strings to grep for in the gated HTML.
console.log("BIOGRAPHY:", JSON.stringify(p.biography || "(none)"));
console.log("FAMILYMSG:", JSON.stringify(p.familyMessage || "(none)"));
console.log("FATHER:", JSON.stringify(p.fatherNameHebrew || "(none)"));
// a portion claimerName
const port = await db.collection("lzecher_portions").where("projectId", "==", ps.docs[0].id).where("status", "!=", "available").limit(3).get();
console.log("CLAIMER_NAMES:", JSON.stringify(port.docs.map((d) => d.data().claimedByName || (d.data().claimerNames || [])).flat()));
process.exit(0);
