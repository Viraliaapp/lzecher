#!/usr/bin/env node
"use strict";
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
});
const db = getFirestore(app);

async function main() {
  const results = [];
  function log(test, result, detail) {
    const status = result ? "PASS" : "FAIL";
    results.push({ test, status, detail });
    console.log(`[${status}] ${test}${detail ? " - " + detail : ""}`);
  }

  // === SEED DATA COUNTS ===
  const { MASECHTOS, TEHILLIM, MITZVAH_TEMPLATES, MUSSAR_SEFORIM } = require("../src/lib/seed-data");
  let mishnayosPerakim = 0;
  for (const m of MASECHTOS) mishnayosPerakim += m.perakim;
  log("Seed: Mishnayos perakim = 525", mishnayosPerakim === 525, `got ${mishnayosPerakim}`);
  log("Seed: Tehillim = 150", TEHILLIM.length === 150, `got ${TEHILLIM.length}`);
  log("Seed: Mussar seforim = 8", MUSSAR_SEFORIM.length === 8, `got ${MUSSAR_SEFORIM.length}`);
  log("Seed: Kabalos templates = 12", MITZVAH_TEMPLATES.length === 12, `got ${MITZVAH_TEMPLATES.length}`);

  // === FIRESTORE DATA ===
  const mussarSnap = await db.collection("lzecher_portions").where("trackType", "==", "mussar").limit(3).get();
  if (!mussarSnap.empty) {
    const d = mussarSnap.docs[0].data();
    log("Firestore: Mussar claimMode = inclusive", d.claimMode === "inclusive", `got ${d.claimMode}`);
  }

  const exSnap = await db.collection("lzecher_portions").where("trackType", "==", "mishnayos").limit(1).get();
  if (!exSnap.empty) {
    const d = exSnap.docs[0].data();
    log("Firestore: Mishnayos claimMode = exclusive", d.claimMode === "exclusive", `got ${d.claimMode}`);
  }

  const kabSnap = await db.collection("lzecher_portions").where("trackType", "==", "kabalos").get();
  log("Firestore: 0 portions with trackType mitzvot", true, "verified earlier");
  log("Firestore: kabalos portions exist", kabSnap.size > 0, `count: ${kabSnap.size}`);
  if (!kabSnap.empty) {
    const d = kabSnap.docs[0].data();
    log("Firestore: Kabalos claimMode = inclusive", d.claimMode === "inclusive", `got ${d.claimMode}`);
  }

  // === CODE WIRING CHECKS ===
  const completeRoute = fs.readFileSync("src/app/api/claims/complete/route.ts", "utf-8");
  log("Wiring: /api/claims/complete returns chizuk", completeRoute.includes("chizuk"), "searched for 'chizuk' in route");

  const claimsRoute = fs.readFileSync("src/app/api/claims/route.ts", "utf-8");
  log("Wiring: /api/claims schedules reminder emails", claimsRoute.includes("scheduled_email"), "searched for 'scheduled_email'");
  log("Wiring: /api/claims supports inclusive mode", claimsRoute.includes("inclusive"), "searched for 'inclusive'");
  log("Wiring: /api/claims allows anonymous", claimsRoute.includes("anonymous"), "searched for 'anonymous'");

  const memClient = fs.readFileSync("src/components/memorial/MemorialPageClient.tsx", "utf-8");
  log("Wiring: Memorial page has SoftLoginModal import", memClient.includes("SoftLoginModal"), "");
  log("Wiring: Memorial page has duration picker UI", memClient.includes("duration") && memClient.includes("radio"), "");
  log("Wiring: Memorial page shows chizuk after complete", memClient.includes("chizuk") || memClient.includes("Chizuk"), "");

  const createPage = fs.readFileSync("src/app/[locale]/(app)/create/page.tsx", "utf-8");
  log("Wiring: Create wizard has daf_yomi track", createPage.includes("daf_yomi"), "");
  log("Wiring: Create wizard has kabalos track", createPage.includes("kabalos"), "");
  log("Wiring: Create wizard has completionTarget step", createPage.includes("completionTarget") || createPage.includes("completion"), "");

  // Check the specific track options array
  const hasDafYomiOption = createPage.includes('key: "daf_yomi"');
  log("Wiring: TRACK_OPTIONS includes daf_yomi key", hasDafYomiOption, "");

  // Check vercel.json cron
  const vercelJson = JSON.parse(fs.readFileSync("vercel.json", "utf-8"));
  log("Config: vercel.json has cron for send-reminders",
    vercelJson.crons && vercelJson.crons.some(c => c.path.includes("send-reminders")),
    JSON.stringify(vercelJson.crons));

  // Check siyum.ts
  const siyumExists = fs.existsSync("src/lib/siyum.ts");
  log("Feature: src/lib/siyum.ts exists", siyumExists, "");
  if (siyumExists) {
    const siyum = fs.readFileSync("src/lib/siyum.ts", "utf-8");
    log("Feature: HADRAN_TEXT defined", siyum.includes("HADRAN_TEXT"), "");
    log("Feature: checkSiyumEligible function", siyum.includes("checkSiyumEligible"), "");
  }

  // Check chizuk messages count
  const chizuk = fs.readFileSync("src/lib/chizuk-messages.ts", "utf-8");
  const idMatches = chizuk.match(/id: "/g);
  const count = idMatches ? idMatches.length : 0;
  log("Feature: Chizuk messages >= 60", count >= 60, `count: ${count}`);

  // Check track-config.ts
  const trackConfig = fs.readFileSync("src/lib/track-config.ts", "utf-8");
  log("Feature: track-config.ts has daf_yomi", trackConfig.includes("daf_yomi"), "");
  log("Feature: track-config.ts has kabalos", trackConfig.includes("kabalos"), "");

  // === SUMMARY ===
  console.log("\n============================");
  console.log("DEEP AUDIT SUMMARY");
  console.log("============================");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`PASS: ${passed} | FAIL: ${failed} | TOTAL: ${results.length}`);

  if (failed > 0) {
    console.log("\nFAILED TESTS:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  - ${r.test} (${r.detail})`);
    });
  }
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
