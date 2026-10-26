import test, { before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { MemoryFirestore } from "./support/fake-firestore";
import { NextRequest } from "next/server";
import { signToken, TTL } from "../../src/lib/signed-tokens";

const root = process.cwd();
const require = createRequire(import.meta.url);
const output = path.join(root, ".next", "audit-unit");
fs.mkdirSync(output, { recursive: true });
type State = { db: MemoryFirestore; access: boolean; reminders: unknown[] };
const state: State = { db: new MemoryFirestore(), access: false, reminders: [] };
(globalThis as any).__lzecherAudit = state;
const stubs: Record<string, string> = {
  "firebase/admin": `export const getAdminDb = () => globalThis.__lzecherAudit.db;
    export const getAdminAuth = () => ({verifyIdToken: async token => {
      if (!['owner', 'learner', 'outsider', 'admin'].includes(token)) throw new Error('Invalid token');
      return {uid:token, isAdmin:token==='admin', lzecherPermissions:token==='admin'?['projects']:[], email:token+'@example.test'};
    }});`,
  "project-access": `export const hasProjectAccess = async () => globalThis.__lzecherAudit.access;`,
  "rate-limit": `export const checkRateLimit = async () => ({success:true}); export const getClientIp = () => '127.0.0.1';`,
  "queue-reminders": `export const sanitizeReminderPreferences = v => Array.isArray(v) ? v : []; export const normalizeFutureTimestamp = (v,now) => typeof v === "number" && v > now ? v : null; export const queueRemindersForClaim = async value => {globalThis.__lzecherAudit.reminders.push(value)};`,
  "recompute-progress": `export const recomputeProjectProgress = async () => ({});`,
  "recompute-global": `export const recomputeGlobalStats = async () => ({});`,
  "open-next-set": `export const maybeOpenNextSet = async () => ({newSetOpened:false,newSetNumber:null});`,
};
async function route(file: string, name: string) {
  const outfile = path.join(output, `${name}.cjs`);
  await build({ entryPoints: [path.join(root, file)], outfile, bundle: true, platform: "node", format: "cjs", packages: "external", logLevel: "silent",
    plugins: [{ name: "isolated-services", setup(builder) {
      builder.onResolve({ filter: /./ }, args => {
        const key = Object.keys(stubs).find(key => args.path.endsWith("/" + key));
        return key ? { path: key, namespace: "audit-stub" } : undefined;
      });
      builder.onLoad({ filter: /.*/, namespace: "audit-stub" }, args => ({ contents: stubs[args.path], loader: "js" }));
    } }],
  });
  return require(outfile);
}
let routes: Record<string, any>;
before(async () => { routes = {
  manage: await route("src/app/api/projects/[id]/claims/[claimId]/route.ts", "manage"),
  list: await route("src/app/api/projects/[id]/claims/route.ts", "list"),
  single: await route("src/app/api/claims/route.ts", "single"),
  multi: await route("src/app/api/claims/multi/route.ts", "multi"),
  bulk: await route("src/app/api/claims/bulk/route.ts", "bulk"),
  complete: await route("src/app/api/claims/complete/route.ts", "complete"),
  batchComplete: await route("src/app/api/claims/complete-batch/route.ts", "batch-complete"),
  bulkComplete: await route("src/app/api/claims/complete-bulk/route.ts", "bulk-complete"),
  overview: await route("src/app/api/admin/super/overview/route.ts", "overview"),
  emailComplete: await route("src/app/api/claims/mark-complete-via-link/route.ts", "email-complete"),
}; });
function setup() {
  state.access = false; state.reminders = [];
  state.db = new MemoryFirestore().put("lzecher_projects", "p", { status: "active", createdBy: "owner", repeatingSetEnabled: false });
  for (const id of ["one", "two"]) state.db.put("lzecher_portions", id, { projectId: "p", trackType: "mishnayos", reference: "Bava Kamma 1", masechet: "Bava Kamma", status: "available" });
}
function request(body: unknown) { return new Request("http://localhost/api/test", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }); }
function context(claimId = "claim") { return { params: Promise.resolve({ id: "p", claimId }) }; }
const basic = { projectId: "p", claimerName: "Learner", portionId: "one", idToken: "learner" };

test("HTTP rename enforces 401, 403, validation, and owner success", async () => {
  setup(); const created = await (await routes.single.POST(request(basic))).json();
  for (const [body, status] of [[{},401],[{idToken:"expired",userName:"New"},401],[{idToken:"outsider",userName:"New"},403],[{idToken:"owner",userName:{}},400],[{idToken:"owner",userName:"New"},200]] as const) {
    const response = await routes.manage.PATCH(request(body), context(created.claimId));
    assert.equal(response.status, status);
  }
  assert.equal(state.db.data("lzecher_portions", "one")!.claimedByName, "New");
});
test("HTTP bulk Bava Kamma list exposes editable child entries and hides summary", async () => {
  setup(); const response = await routes.bulk.POST(request({ ...basic, scope: "masechta", scopeId: "Bava Kamma" }));
  assert.equal(response.status, 200); const bulk = await response.json(); assert.equal(bulk.claimedCount, 2);
  const list = await routes.list.POST(request({ idToken: "owner" }), context());
  const rows = (await list.json()).claims;
  assert.equal(rows.length, 2); assert.ok(rows.every((row: any) => !row.isParent && row.reference));
  assert.equal((await routes.manage.PATCH(request({ idToken: "owner", userName: "Replacement" }), context(rows[0].id))).status, 200);
  assert.equal(state.db.data("lzecher_portions", rows[0].portionId)!.claimedByName, "Replacement");
});
test("HTTP multi deduplicates IDs and returns nonnegative skipped counts; retry cannot overwrite", async () => {
  setup(); const body = { ...basic, portionIds: ["one", "one", "two"] };
  const response = await routes.multi.POST(request(body)); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, claimedCount: 2, skippedCount: 0 });
  assert.equal((await routes.multi.POST(request({ ...body, claimerName: "Different" }))).status, 409);
  assert.equal(state.db.data("lzecher_portions", "one")!.claimedByName, "Learner");
});
test("HTTP concurrent single requests yield 200/409 and one durable claim", async () => {
  setup(); const result = await Promise.all([routes.single.POST(request(basic)), routes.single.POST(request({ ...basic, claimerName: "Other" }))]);
  assert.deepEqual(result.map(r => r.status).sort(), [200,409]);
  assert.equal((await state.db.collection("lzecher_claims").get()).size, 1);
});
test("HTTP bad token cannot silently create an anonymous commitment", async () => {
  setup(); for (const key of ["single", "multi", "bulk"] as const) {
    const response = await routes[key].POST(request({ ...basic, idToken: "expired", portionIds: ["one"], scope: "shas" }));
    assert.equal(response.status, 401);
  }
  assert.equal((await state.db.collection("lzecher_claims").get()).size, 0);
});
test("HTTP protected/foreign/locked project reservations are rejected before writes", async () => {
  setup(); state.db.put("lzecher_projects", "p", { status: "active", passwordHash: "synthetic" });
  assert.equal((await routes.single.POST(request(basic))).status, 403);
  state.access = true; assert.equal((await routes.single.POST(request(basic))).status, 200);
  state.db.put("lzecher_projects", "p", { status: "active", locked: true });
  assert.equal((await routes.single.POST(request({ ...basic, portionId: "two" }))).status, 423);
});
test("HTTP bulk invalid scope and missing scope ID cannot broaden completion or reservation", async () => {
  setup(); for (const body of [{scope:"bad"},{scope:"masechta"},{scope:"tehillim_book",scopeId:"9"}]) {
    assert.equal((await routes.bulk.POST(request({...basic,...body}))).status, 400);
    assert.equal((await routes.bulkComplete.POST(request({ projectId:"p",idToken:"learner",...body}))).status, 400);
  }
});
test("HTTP single and batch completion stay in sync and retries do not recount", async () => {
  setup(); await routes.multi.POST(request({ ...basic, portionIds: ["one", "two"] }));
  const response = await routes.batchComplete.POST(request({ projectId: "p", portionIds: ["one", "one", "two"], idToken: "learner" }));
  assert.equal(response.status, 200); assert.equal((await response.json()).count, 2);
  const again = await routes.batchComplete.POST(request({ projectId: "p", portionIds: ["one", "two"], idToken: "learner" }));
  assert.equal((await again.json()).count, 0);
  const children = (await state.db.collection("lzecher_claims").get()).docs.filter(d => !d.data()!.isParent);
  assert.ok(children.every(d => d.data()!.status === "completed"));
});
test("HTTP completion rejects mismatched claim IDs without changing the portion", async () => {
  setup(); await routes.single.POST(request(basic));
  state.db.put("lzecher_claims", "foreign", { projectId: "other", portionId: "two", status: "active" });
  const response = await routes.complete.POST(request({ projectId: "p", portionId: "one", claimId: "foreign", idToken: "learner" }));
  assert.equal(response.status, 400); assert.equal(state.db.data("lzecher_portions", "one")!.status, "claimed");
});
test("HTTP bulk completion leaves other users' commitments untouched", async () => {
  setup(); await routes.single.POST(request(basic)); await routes.single.POST(request({ ...basic, portionId: "two", idToken: "outsider" }));
  const response = await routes.bulkComplete.POST(request({ projectId: "p", scope: "all_my_claims_in_project", idToken: "learner" }));
  assert.equal(response.status, 200); assert.equal((await response.json()).completedCount, 1);
  assert.equal(state.db.data("lzecher_portions", "two")!.status, "claimed");
});

test("HTTP named anonymous inclusive claim remains supported", async () => {
  setup(); state.db.put("lzecher_portions", "inclusive", { projectId: "p", trackType: "kabalos", claimMode: "inclusive", status: "available", reference: "Kindness" });
  const result = await routes.single.POST(request({ projectId: "p", portionId: "inclusive", claimerName: "Public learner" }));
  assert.equal(result.status, 200);
  const claim = await result.json();
  const complete = await routes.complete.POST(request({ projectId: "p", portionId: "inclusive", claimId: claim.claimId, completedByName: "Public learner" }));
  assert.equal(complete.status, 200);
  assert.equal(state.db.data("lzecher_portions", "inclusive")!.status, "available");
});
test("HTTP concurrent multi and single reservations cannot overwrite each other", async () => {
  setup(); const results = await Promise.all([routes.multi.POST(request({ ...basic, portionIds: ["one"] })), routes.single.POST(request({ ...basic, idToken: "outsider", claimerName: "Other" }))]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const claims = (await state.db.collection("lzecher_claims").get()).docs.filter(d => !d.data()!.isParent);
  assert.equal(claims.length, 1); assert.equal(state.db.data("lzecher_portions", "one")!.claimId, claims[0].id);
});
test("HTTP daily check-in retries count once and require the owning account", async () => {
  setup(); state.db.put("lzecher_claims", "daily", { projectId: "p", userId: "learner", duration: "daily", status: "active", progress: { completed: 0, total: 3 } });
  const body = { projectId: "p", claimId: "daily", checkIn: true, idToken: "learner" };
  assert.equal((await routes.complete.POST(request({ ...body, idToken: "outsider" }))).status, 403);
  for (const result of await Promise.all([routes.complete.POST(request(body)), routes.complete.POST(request(body))])) assert.equal(result.status, 200);
  assert.equal(state.db.data("lzecher_claims", "daily")!.progress.completed, 1);
});
test("HTTP email GET is read-only, POST completes exact learning, and retry is stable", async () => {
  setup(); const result = await (await routes.single.POST(request(basic))).json();
  const token = signToken({ purpose: "mark_complete", claimId: result.claimId }, TTL.MARK_COMPLETE);
  const before = structuredClone(state.db.records);
  const response = await routes.emailComplete.GET(new NextRequest(`http://localhost/api/claims/mark-complete-via-link?token=${token}&locale=he`));
  assert.equal(response.status, 303); assert.match(response.headers.get("location"), /\/he\/confirm-complete\?status=confirm/);
  assert.deepEqual(state.db.records, before);
  const post = () => routes.emailComplete.POST(new NextRequest("http://localhost/api/claims/mark-complete-via-link", { method: "POST", body: new URLSearchParams({ token, locale: "he" }) }));
  assert.match((await post()).headers.get("location"), /status=success/);
  assert.equal(state.db.data("lzecher_portions", "one")!.status, "completed");
  assert.match((await post()).headers.get("location"), /status=already_complete/);
});
test("HTTP stale parent reminder never completes a replacement reservation", async () => {
  setup(); const parent = await (await routes.bulk.POST(request({ ...basic, scope: "shas" }))).json();
  const first = (await state.db.collection("lzecher_claims").get()).docs.find(d => d.data()!.portionId === "one")!;
  await routes.manage.DELETE(request({ idToken: "owner" }), context(first.id));
  await routes.single.POST(request({ ...basic, idToken: "outsider", claimerName: "Other" }));
  const token = signToken({ purpose: "mark_complete", claimId: parent.parentClaimId }, TTL.MARK_COMPLETE);
  await routes.emailComplete.POST(new NextRequest("http://localhost/api/claims/mark-complete-via-link", { method: "POST", body: new URLSearchParams({ token }) }));
  assert.equal(state.db.data("lzecher_portions", "one")!.status, "claimed");
  assert.equal(state.db.data("lzecher_portions", "two")!.status, "completed");
});
test("HTTP bulk completion leaves inclusive shared portions available", async () => {
  setup(); state.db.put("lzecher_portions", "inclusive", { projectId: "p", trackType: "kabalos", claimMode: "inclusive", status: "available", reference: "Kindness" });
  await routes.single.POST(request({ ...basic, portionId: "inclusive" }));
  const response = await routes.bulkComplete.POST(request({ projectId: "p", scope: "all_my_claims_in_project", idToken: "learner" }));
  assert.equal(response.status, 200); assert.equal((await response.json()).completedCount, 1);
  assert.equal(state.db.data("lzecher_portions", "inclusive")!.status, "available");
});

test("HTTP admin overview honors stats permission and management rejects unscoped admins", async () => {
  setup(); state.db.put("lzecher_users", "admin", { isAdmin: true, permissions: [] });
  const response = await routes.overview.POST(request({ idToken: "admin" }));
  assert.equal(response.status, 200); const overview = await response.json();
  assert.deepEqual(overview.stats, {}); assert.deepEqual(overview.recentClaims, []); assert.deepEqual(overview.projectSummaries, []);
  await routes.single.POST(request(basic)); const claim = (await state.db.collection("lzecher_claims").get()).docs[0];
  assert.equal((await routes.manage.PATCH(request({ idToken: "admin", userName: "New" }), context(claim.id))).status, 403);
  state.db.put("lzecher_users", "admin", { isAdmin: true, permissions: ["stats"] });
  const allowed = await (await routes.overview.POST(request({ idToken: "admin" }))).json();
  assert.equal(allowed.stats.totalProjects, 1);
});

test("HTTP malformed IDs and missing project are rejected without writes", async () => {
  setup(); const before = structuredClone(state.db.records);
  for (const portionId of [undefined, ".", "..", "bad/id", 123]) assert.equal((await routes.single.POST(request({ ...basic, portionId }))).status, 400);
  assert.equal((await routes.complete.POST(request(null))).status, 400);
  assert.equal((await routes.bulkComplete.POST(request(null))).status, 400);
  assert.equal((await routes.batchComplete.POST(request({ projectId: "missing", portionIds: ["one"], idToken: "learner" }))).status, 404);
  assert.deepEqual(state.db.records, before);
});

test("HTTP reminder rejects an unrelated signed-token purpose and retains legacy actions", async () => {
  setup(); const created = await (await routes.single.POST(request(basic))).json();
  const wrong = signToken({ purpose: "email_signin", claimId: created.claimId, email: "audit@example.test" }, TTL.EMAIL_SIGNIN);
  const send = (token: string) => routes.emailComplete.POST(new NextRequest("http://localhost/api/claims/mark-complete-via-link", { method: "POST", body: new URLSearchParams({ token }) }));
  assert.match((await send(wrong)).headers.get("location"), /status=expired/);
  assert.equal(state.db.data("lzecher_portions", "one")!.status, "claimed");
  assert.match((await send(routes.emailComplete.generateActionToken(created.claimId))).headers.get("location"), /status=success/);
});
