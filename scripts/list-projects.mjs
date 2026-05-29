import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();
const snap = await db.collection("lzecher_projects").get();
snap.docs.forEach(d => {
  const data = d.data();
  console.log(d.id, JSON.stringify({ slug: data.slug, name: data.nameHebrew, tracks: data.tracks, createdBy: data.createdBy?.slice(0,8) }));
});
