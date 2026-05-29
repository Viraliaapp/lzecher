/** set/unset started-by on lz8uqv. arg: set | unset */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();
const ps = await db.collection("lzecher_projects").where("slug", "==", "memorial-lz8uqv").limit(1).get();
const ref = ps.docs[0].ref;
const prev = ps.docs[0].data();
if (process.argv[2] === "set") {
  await ref.update({ startedByText: "משפחת אהרונוביץ", startedByVisible: true });
  console.log("SET started-by on lz8uqv (prev:", JSON.stringify(prev.startedByText || null), prev.startedByVisible || false, ")");
} else {
  await ref.update({ startedByText: null, startedByVisible: false });
  console.log("UNSET started-by on lz8uqv");
}
process.exit(0);
