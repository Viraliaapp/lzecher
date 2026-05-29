/** Cleanup a test claim: delete claim doc + reset portion to available. arg: <claimId> <portionId> */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();
const [claimId, portionId] = process.argv.slice(2);
if (claimId) await db.collection("lzecher_claims").doc(claimId).delete().catch((e) => console.log("claim del:", e.message));
if (portionId) await db.collection("lzecher_portions").doc(portionId).update({ status: "available", claimedBy: null, claimedByName: null, claimedAt: null });
console.log(`restored: deleted claim ${claimId}, reset portion ${portionId}`);
process.exit(0);
