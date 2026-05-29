import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();
const ps = await db.collection("lzecher_projects").where("slug", "==", "memorial-ay5ukw").limit(1).get();
const id = ps.docs[0].id;
const kab = await db.collection("lzecher_portions").where("projectId", "==", id).where("trackType", "==", "kabalos").get();
const NEW = new Set(["קבלת שבת 10 דקות מוקדם", "עניית אמן בכוונה", "לימוד שמירת הלשון", "נתינת צדקה לעילוי נשמת", "להודות להשם", "קבלה אישית"]);
for (const d of kab.docs) {
  const x = d.data();
  const name = x.displayNameHebrew || x.reference;
  const isNew = NEW.has(name);
  console.log(`${isNew ? "NEW" : "OLD"} | "${name}" | claimers=${(x.claimerNames || []).length} count=${x.currentClaimerCount || 0} | id=${d.id}`);
  if (!isNew) console.log(`     names: ${JSON.stringify(x.claimerNames || [])}`);
}
process.exit(0);
