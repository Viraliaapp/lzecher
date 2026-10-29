import test from "node:test";
import assert from "node:assert/strict";
import { MemoryFirestore } from "./support/fake-firestore";
import { manageClaim, claimName } from "../../src/lib/claim-management";
import { reserveClaims } from "../../src/lib/claim-writes";
import { completePortion, checkInClaim } from "../../src/lib/claim-completion";
import { seedSetForTrack } from "../../src/lib/seed-set";
import { maybeOpenNextSet } from "../../src/lib/open-next-set";
import { safeAuthRedirect } from "../../src/lib/auth-redirect";
import { parseClaimInput } from "../../src/lib/claim-input";
import { createTranslator } from "next-intl";
import fs from "node:fs";

const owner = { uid: "owner" };
const values = { userId: "learner", userName: "Original", claimedAt: 123, status: "active", duration: "oneTime" };
function fixture(mode = "exclusive") {
  return new MemoryFirestore().put("lzecher_projects", "p", { createdBy: "owner", status: "active" })
    .put("lzecher_portions", "portion", { projectId: "p", claimMode: mode, trackType: mode === "inclusive" ? "kabalos" : "mishnayos",
      reference: "Bava Kamma 1", status: "claimed", claimedBy: "learner", claimedByName: "Original", claimedAt: 123,
      currentClaimerCount: 1, claimerNames: ["Original"] })
    .put("lzecher_claims", "claim", { ...values, projectId: "p", portionId: "portion" });
}
const rename = (db: MemoryFirestore, name = "Replacement") => manageClaim(db.asFirestore(), "p", "claim", owner, { type: "rename", name });

test("Bava Kamma individual rename updates claim and public portion; retry is stable", async () => {
  const db = fixture(); await rename(db); await rename(db);
  assert.equal(db.data("lzecher_claims", "claim")!.userName, "Replacement");
  assert.equal(db.data("lzecher_portions", "portion")!.claimedByName, "Replacement");
  assert.equal(db.data("lzecher_claims", "claim")!.userId, "learner", "A display rename must not transfer account ownership");
});
test("rename rolls back both documents on interrupted commit", async () => {
  const db = fixture(); db.failTransaction = 1;
  await assert.rejects(rename(db), /Simulated/);
  assert.equal(db.data("lzecher_claims", "claim")!.userName, "Original");
  assert.equal(db.data("lzecher_portions", "portion")!.claimedByName, "Original");
  db.failTransaction = -1; await rename(db);
});
test("inclusive rename/delete preserve other participants with the same name", async () => {
  const db = fixture("inclusive").put("lzecher_claims", "second", { ...values, userId: "other", projectId: "p", portionId: "portion" });
  await rename(db);
  assert.deepEqual(db.data("lzecher_portions", "portion")!.claimerNames, ["Replacement", "Original"]);
  await manageClaim(db.asFirestore(), "p", "claim", owner, { type: "delete" });
  await manageClaim(db.asFirestore(), "p", "claim", owner, { type: "delete" });
  assert.deepEqual(db.data("lzecher_portions", "portion")!.claimerNames, ["Original"]);
  assert.equal(db.data("lzecher_portions", "portion")!.currentClaimerCount, 1);
});
test("completed exclusive deletion clears completion metadata and is idempotent", async () => {
  const db = fixture(); await completePortion(db.asFirestore(), "p", "portion", { uid: "learner", name: null }, false);
  await manageClaim(db.asFirestore(), "p", "claim", owner, { type: "delete" });
  await manageClaim(db.asFirestore(), "p", "claim", owner, { type: "delete" });
  const p = db.data("lzecher_portions", "portion")!;
  assert.equal(p.status, "available"); assert.equal(p.completedAt, null); assert.equal(p.claimId, null);
});
for (const scenario of ["foreign owner", "foreign claim", "foreign portion", "stale replacement", "missing portion", "bulk summary"]) {
  test(`rename rejects ${scenario} without any mutation`, async () => {
    const db = fixture(); let actor = owner;
    if (scenario === "foreign owner") actor = { uid: "intruder" };
    if (scenario === "foreign claim") db.put("lzecher_claims", "claim", { ...db.data("lzecher_claims", "claim"), projectId: "other" });
    if (scenario === "foreign portion") db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), projectId: "other" });
    if (scenario === "stale replacement") db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), claimedAt: 999 });
    if (scenario === "missing portion") db.records.delete("lzecher_portions/portion");
    if (scenario === "bulk summary") db.put("lzecher_claims", "claim", { ...db.data("lzecher_claims", "claim"), isParent: true });
    const before = structuredClone(db.records);
    await assert.rejects(manageClaim(db.asFirestore(), "p", "claim", actor, { type: "rename", name: "New" }));
    assert.deepEqual(db.records, before);
  });
}
test("admin can rename another owner's entry", async () => {
  const db = fixture(); await manageClaim(db.asFirestore(), "p", "claim", { uid: "admin", isSuperAdmin: true }, { type: "rename", name: "New" });
  assert.equal(db.data("lzecher_claims", "claim")!.userName, "New");
});
test("simultaneous reservations produce one exclusive winner", async () => {
  const db = fixture(); db.records.delete("lzecher_claims/claim"); db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), status: "available" });
  const results = await Promise.all(["A", "B"].map(userName => reserveClaims(db.asFirestore(), "p", ["portion", "portion"], { ...values, userName }, { access: false })));
  assert.equal(results.flat().length, 1);
  assert.equal((await db.collection("lzecher_claims").get()).size, 1);
});
test("transaction retries do not create orphan claims", async () => {
  const db = fixture(); db.records.delete("lzecher_claims/claim"); db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), status: "available" }); db.retryOnce = true;
  const rows = await reserveClaims(db.asFirestore(), "p", ["portion"], values, { access: false });
  assert.equal((await db.collection("lzecher_claims").get()).size, 1);
  assert.equal(db.data("lzecher_portions", "portion")!.claimId, rows[0].claimId);
});
test("interrupted 525-portion bulk reservation preserves only committed parent IDs and resumes safely", async () => {
  const db = new MemoryFirestore().put("lzecher_projects", "p", { status: "active" });
  const ids = Array.from({ length: 525 }, (_, i) => `p${i}`);
  for (const id of ids) db.put("lzecher_portions", id, { projectId: "p", trackType: "mishnayos", status: "available" });
  db.failTransaction = 2;
  await assert.rejects(reserveClaims(db.asFirestore(), "p", ids, values, { access: false, parentId: "parent", parent: { scope: "shas" } }));
  assert.equal(db.data("lzecher_claims", "parent")!.portionIds.length, 200);
  db.failTransaction = -1;
  const resumed = await reserveClaims(db.asFirestore(), "p", ids, values, { access: false, parentId: "parent", parent: { scope: "shas" } });
  assert.equal(resumed.length, 325); assert.equal(db.data("lzecher_claims", "parent")!.portionIds.length, 525);
  assert.equal((await db.collection("lzecher_claims").get()).size, 526); assert.ok(db.maxWrites <= 402);
});
for (const scenario of ["missing", "locked", "protected", "foreign", "inclusive anonymous"]) test(`reservation rejects ${scenario}`, async () => {
  const db = fixture(scenario === "inclusive anonymous" ? "inclusive" : "exclusive");
  db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), status: "available" });
  if (scenario === "missing") db.records.delete("lzecher_projects/p");
  if (scenario === "locked") db.put("lzecher_projects", "p", { status: "active", locked: true });
  if (scenario === "protected") db.put("lzecher_projects", "p", { status: "active", passwordHash: "synthetic" });
  if (scenario === "foreign") db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), projectId: "other" });
  const before = structuredClone(db.records);
  await assert.rejects(reserveClaims(db.asFirestore(), "p", ["portion"], { ...values, userId: "anonymous" }, { access: false, allowInclusive: true }));
  assert.deepEqual(db.records, before);
});
test("completion validates supplied claim/portion/project relationships before writes", async () => {
  const db = fixture().put("lzecher_claims", "foreign", { ...values, projectId: "other", portionId: "portion" });
  const before = structuredClone(db.records);
  await assert.rejects(completePortion(db.asFirestore(), "p", "portion", { uid: "learner", name: null }, false, "foreign"));
  assert.deepEqual(db.records, before);
});
test("completion is repeatable and repairs previously interrupted claim sync", async () => {
  const db = fixture();
  assert.equal(await completePortion(db.asFirestore(), "p", "portion", { uid: null, name: "Public learner" }, false), true);
  db.put("lzecher_claims", "claim", { ...db.data("lzecher_claims", "claim"), status: "active" });
  assert.equal(await completePortion(db.asFirestore(), "p", "portion", { uid: null, name: "Public learner" }, false), false);
  assert.equal(db.data("lzecher_claims", "claim")!.status, "completed");
});
test("inclusive completion supports named public participation and leaves the shared portion available", async () => {
  const db = fixture("inclusive"); db.put("lzecher_portions", "portion", { ...db.data("lzecher_portions", "portion"), status: "available" });
  await assert.rejects(completePortion(db.asFirestore(), "p", "portion", { uid: "other", name: null }, false, "claim"));
  await completePortion(db.asFirestore(), "p", "portion", { uid: null, name: "Public learner" }, false, "claim");
  await completePortion(db.asFirestore(), "p", "portion", { uid: "learner", name: null }, false, "claim");
  assert.equal(db.data("lzecher_portions", "portion")!.status, "available");
});
test("daily check-in duplicate and concurrent retries count once; next interval counts", async () => {
  const db = fixture("inclusive"); db.put("lzecher_claims", "claim", { ...db.data("lzecher_claims", "claim"), duration: "daily", progress: { completed: 0, total: 2 } });
  await Promise.all([1,2].map(() => checkInClaim(db.asFirestore(), "p", "claim", "learner", 100000000)));
  assert.equal(db.data("lzecher_claims", "claim")!.progress.completed, 1);
  await checkInClaim(db.asFirestore(), "p", "claim", "learner", 100000000 + 86400000);
  const result = await checkInClaim(db.asFirestore(), "p", "claim", "learner", 100000000 + 86400001);
  assert.equal(result.completed, 2); assert.equal(result.claimCompleted, true);
  await assert.rejects(checkInClaim(db.asFirestore(), "other", "claim", "learner"));
});
test("weekly check-in waits a week", async () => {
  const db = fixture("inclusive"); db.put("lzecher_claims", "claim", { ...db.data("lzecher_claims", "claim"), duration: "weekly" });
  await checkInClaim(db.asFirestore(), "p", "claim", "learner", 100000000);
  assert.equal((await checkInClaim(db.asFirestore(), "p", "claim", "learner", 100000000 + 86400000)).completed, 1);
});
test("repeating-set seeding is idempotent under concurrent calls and preserves claimed entries", async () => {
  const db = new MemoryFirestore().put("lzecher_projects", "p", { status: "active" });
  await Promise.all([seedSetForTrack(db.asFirestore(), "p", "tehillim", 2), seedSetForTrack(db.asFirestore(), "p", "tehillim", 2)]);
  assert.equal((await db.collection("lzecher_portions").get()).size, 150);
  const first = (await db.collection("lzecher_portions").get()).docs[0]; await first.ref.update({ status: "claimed" });
  assert.equal(await seedSetForTrack(db.asFirestore(), "p", "tehillim", 2), 0);
  assert.equal((await first.ref.get()).data()!.status, "claimed");
});
test("partial Mishnayos seed recovers all 525 entries after interruption", async () => {
  const db = new MemoryFirestore(); db.failTransaction = 2;
  await assert.rejects(seedSetForTrack(db.asFirestore(), "p", "mishnayos", 2));
  assert.equal((await db.collection("lzecher_portions").get()).size, 400);
  db.failTransaction = -1;
  assert.equal(await seedSetForTrack(db.asFirestore(), "p", "mishnayos", 2), 125);
  assert.equal((await db.collection("lzecher_portions").get()).size, 525);
});
test("set opening refuses incomplete sets even with caller exclusion IDs", async () => {
  const db = new MemoryFirestore().put("lzecher_projects", "p", { status: "active" });
  await seedSetForTrack(db.asFirestore(), "p", "tehillim", 1);
  const ids = new Set((await db.collection("lzecher_portions").get()).docs.map(d => d.id));
  const result = await maybeOpenNextSet(db.asFirestore(), "p", "tehillim", 1, ids, {});
  assert.equal(result.newSetOpened, false); assert.equal((await db.collection("lzecher_portions").get()).size, 150);
});
test("login redirect rejects executable/external destinations and strips one locale", () => {
  for (const input of ["javascript:alert(1)", "https://example.test", "//example.test", "/en//example.test", "/he/%2fexample.test", "/\\example.test", "/%5cexample.test", "/%252f%252fexample.test", "/login?finishSignIn=true", null]) assert.equal(safeAuthRedirect(input), "/dashboard");
  assert.equal(safeAuthRedirect("/he/dashboard?tab=learning#entry"), "/dashboard?tab=learning#entry");
  assert.equal(safeAuthRedirect("/memorial/example"), "/memorial/example");
});
test("claim input rejects malformed names, IDs, durations and reminder preferences", () => {
  for (const name of [null, {}, " ", "x".repeat(101)]) assert.throws(() => claimName(name));
  for (const update of [{ projectId: "a/b" }, { durationValue: -1 }, { duration: "bogus" }, { reminderPreferences: ["bogus"] }]) assert.throws(() => parseClaimInput({ projectId: "p", claimerName: "Name", ...update }));
});
test("participant pluralization renders singular and plural in all four locales", () => {
  for (const locale of ["en", "he", "es", "fr"]) {
    const messages = JSON.parse(fs.readFileSync(`messages/${locale}.json`, "utf8"));
    const t = createTranslator({ locale, messages, namespace: "landing" });
    assert.notEqual(t("participantCount", { count: 1 }), t("participantCount", { count: 2 }));
    if (locale === "en") { assert.equal(t("participantCount", { count: 1 }), "1 participant"); assert.equal(t("participantCount", { count: 2 }), "2 participants"); }
  }
});
