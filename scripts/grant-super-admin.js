const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

if (!projectId) {
  console.error("Error: FIREBASE_ADMIN_PROJECT_ID or FIREBASE_PROJECT_ID is required");
  process.exit(1);
}

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: npm run admin:grant-super -- <UID>");
  console.error("\nTo find your UID, run: npm run admin:list");
  process.exit(1);
}

const appConfig = { projectId };
if (clientEmail && privateKey) {
  appConfig.credential = admin.credential.cert({ projectId, clientEmail, privateKey });
}

admin.initializeApp(appConfig);

async function main() {
  try {
    await admin.auth().setCustomUserClaims(uid, { isAdmin: true, isSuperAdmin: true });
    console.log(`\nSuccess! User ${uid} now has isAdmin: true, isSuperAdmin: true`);
    console.log("They will need to log out and log back in for the claims to take effect.\n");

    const user = await admin.auth().getUser(uid);
    console.log("User details:");
    console.log(`  Email: ${user.email || "(none)"}`);
    console.log(`  Display Name: ${user.displayName || "(none)"}`);
    console.log(`  Custom Claims: ${JSON.stringify(user.customClaims)}\n`);
  } catch (err) {
    console.error("Error granting super admin:", err.message);
    process.exit(1);
  }
}

main();
