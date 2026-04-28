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

const appConfig = { projectId };
if (clientEmail && privateKey) {
  appConfig.credential = admin.credential.cert({ projectId, clientEmail, privateKey });
}

admin.initializeApp(appConfig);

async function main() {
  try {
    const result = await admin.auth().listUsers(10);
    console.log("\n=== Most Recent 10 Firebase Auth Users ===\n");
    if (result.users.length === 0) {
      console.log("No users found. Log in to the app first to create an auth user.");
      return;
    }
    console.log(
      "UID".padEnd(30) +
      "Email".padEnd(35) +
      "Created"
    );
    console.log("-".repeat(85));
    for (const user of result.users) {
      const created = user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString()
        : "N/A";
      console.log(
        (user.uid || "").padEnd(30) +
        (user.email || "(no email)").padEnd(35) +
        created
      );
    }
    console.log(`\nTotal: ${result.users.length} user(s)\n`);
    console.log("To grant admin access, run:");
    console.log("  npm run admin:grant -- <UID>\n");
  } catch (err) {
    console.error("Error listing users:", err.message);
    process.exit(1);
  }
}

main();
