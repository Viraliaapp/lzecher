/**
 * diagnose-reminders.mjs
 *
 * Run with:
 *   dotenv -e .env.local -- node scripts/diagnose-reminders.mjs
 *
 * What this script does:
 *   1. Connects to Firestore using Firebase Admin SDK.
 *   2. Queries lzecher_scheduled_emails — status breakdown + samples.
 *   3. Tests Resend: lists verified domains, then sends a test email
 *      from noreply@lzecher.com to solomon2145@gmail.com.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";

// ─── SAFETY GUARD ─────────────────────────────────────────────────────────────
console.log("=".repeat(60));
console.log("DIAGNOSE-REMINDERS — READ-ONLY diagnostic script");
console.log("Collections touched:  lzecher_scheduled_emails (reads only)");
console.log("Resend: domain list + 1 test email sent to solomon2145@gmail.com");
console.log("=".repeat(60));
console.log();

// ─── ENV VALIDATION ───────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "RESEND_API_KEY",
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error("ERROR: Missing required environment variables:");
  missing.forEach((v) => console.error(`  - ${v}`));
  console.error(
    "\nRun this script with:  dotenv -e .env.local -- node scripts/diagnose-reminders.mjs"
  );
  process.exit(1);
}

// ─── FIREBASE INIT ────────────────────────────────────────────────────────────
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ─── HELPER ───────────────────────────────────────────────────────────────────
function formatDoc(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    status: d.status,
    to: d.to,
    subject: d.subject,
    scheduledFor: d.scheduledFor?.toDate?.()?.toISOString() ?? d.scheduledFor,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
    lastError: d.lastError ?? null,
    attemptCount: d.attemptCount ?? null,
  };
}

// ─── SECTION 1: FIRESTORE QUERY ───────────────────────────────────────────────
async function diagnoseFirestore() {
  console.log("─".repeat(60));
  console.log("SECTION 1: lzecher_scheduled_emails");
  console.log("─".repeat(60));

  const col = db.collection("lzecher_scheduled_emails");

  // Count all docs (full scan — acceptable for diagnostics)
  const allSnap = await col.get();
  const total = allSnap.size;
  console.log(`Total documents: ${total}`);

  if (total === 0) {
    console.log("Collection is empty — nothing to diagnose.\n");
    return;
  }

  // Build status breakdown from full scan
  const statusMap = {};
  allSnap.docs.forEach((doc) => {
    const status = doc.data().status ?? "(no status)";
    statusMap[status] = (statusMap[status] ?? 0) + 1;
  });

  console.log("\nStatus breakdown:");
  Object.entries(statusMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  // Sample 3 failed docs
  console.log("\nSample FAILED docs (up to 3):");
  const failedSnap = await col
    .where("status", "==", "failed")
    .limit(3)
    .get();

  if (failedSnap.empty) {
    console.log("  (none found)");
  } else {
    failedSnap.docs.forEach((doc, i) => {
      const formatted = formatDoc(doc);
      console.log(`\n  [Failed #${i + 1}]`);
      console.log(`    id:           ${formatted.id}`);
      console.log(`    to:           ${formatted.to}`);
      console.log(`    subject:      ${formatted.subject}`);
      console.log(`    scheduledFor: ${formatted.scheduledFor}`);
      console.log(`    attemptCount: ${formatted.attemptCount}`);
      console.log(`    lastError:    ${JSON.stringify(formatted.lastError)}`);
    });
  }

  // Sample 3 pending docs
  console.log("\nSample PENDING docs (up to 3):");
  const pendingSnap = await col
    .where("status", "==", "pending")
    .limit(3)
    .get();

  if (pendingSnap.empty) {
    console.log("  (none found)");
  } else {
    pendingSnap.docs.forEach((doc, i) => {
      const formatted = formatDoc(doc);
      console.log(`\n  [Pending #${i + 1}]`);
      console.log(`    id:           ${formatted.id}`);
      console.log(`    to:           ${formatted.to}`);
      console.log(`    subject:      ${formatted.subject}`);
      console.log(`    scheduledFor: ${formatted.scheduledFor}`);
      console.log(`    createdAt:    ${formatted.createdAt}`);
    });
  }

  console.log();
}

// ─── SECTION 2: RESEND DIAGNOSTICS ───────────────────────────────────────────
async function diagnoseResend() {
  console.log("─".repeat(60));
  console.log("SECTION 2: Resend");
  console.log("─".repeat(60));

  const resend = new Resend(process.env.RESEND_API_KEY);

  // List domains
  console.log("\n[2a] Verified domains:");
  const { data: domainsData, error: domErr } = await resend.domains.list();
  if (domErr) {
    console.log(`  ERROR listing domains: ${JSON.stringify(domErr)}`);
  } else {
    const domains = domainsData?.data ?? domainsData ?? [];
    if (!domains.length) {
      console.log("  (no domains returned)");
    } else {
      domains.forEach((d) => {
        console.log(
          `  - ${d.name}  status=${d.status}  region=${d.region ?? "n/a"}`
        );
      });

      const lzecherDomain = domains.find((d) =>
        d.name?.includes("lzecher.com")
      );
      if (lzecherDomain) {
        console.log(
          `\n  lzecher.com domain found — status: ${lzecherDomain.status}`
        );
        if (lzecherDomain.status !== "verified") {
          console.log(
            "  WARNING: lzecher.com is NOT verified. Emails from noreply@lzecher.com may fail."
          );
        }
      } else {
        console.log(
          "\n  WARNING: lzecher.com was NOT found in verified domains list."
        );
      }
    }
  }

  // Send test email
  console.log("\n[2b] Sending test email:");
  console.log("  from: noreply@lzecher.com");
  console.log("  to:   solomon2145@gmail.com");

  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: "Lzecher Reminders <noreply@lzecher.com>",
    to: "solomon2145@gmail.com",
    subject: "Lzecher Reminder Diagnostic Test",
    html: [
      "<h2>Lzecher Diagnostic Test</h2>",
      "<p>This is an automated diagnostic email from <code>diagnose-reminders.mjs</code>.</p>",
      "<p>If you received this, Resend is correctly configured for <strong>noreply@lzecher.com</strong>.</p>",
      `<p><small>Sent at: ${new Date().toISOString()}</small></p>`,
    ].join("\n"),
  });

  if (sendErr) {
    console.log(`  RESULT: FAILED`);
    console.log(`  Error: ${JSON.stringify(sendErr)}`);
  } else {
    console.log(`  RESULT: SUCCESS (HTTP 200)`);
    console.log(`  Email ID: ${sendData?.id}`);
  }

  console.log();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await diagnoseFirestore();
    await diagnoseResend();

    console.log("─".repeat(60));
    console.log("Diagnostic complete.");
    console.log("─".repeat(60));
  } catch (err) {
    console.error("\nFATAL ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
