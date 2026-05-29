/** Temporarily set/unset a password on a project to verify the gate. arg: set <pw> | unset */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();

const SLUG = "memorial-upvad8";
const action = process.argv[2];
const pw = process.argv[3];

const ps = await db.collection("lzecher_projects").where("slug", "==", SLUG).limit(1).get();
const ref = ps.docs[0].ref;

if (action === "set") {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw.normalize("NFKC"), salt, 32, { N: 16384 }).toString("hex");
  await ref.update({ passwordHash: hash, passwordSalt: salt });
  console.log(`SET password on ${SLUG}`);
} else {
  await ref.update({ passwordHash: null, passwordSalt: null });
  console.log(`UNSET password on ${SLUG} (restored to open)`);
}
process.exit(0);
