import test, { before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { MemoryFirestore } from "./support/fake-firestore";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";
import { signToken, TTL } from "../../src/lib/signed-tokens";

const root = process.cwd();
const require = createRequire(import.meta.url);
const output = path.join(root, ".next", "audit-baseline");
const BASELINE = "a9ea2afff49c71b2c6ead02fef185af78c17a9cd";
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
  await build({ stdin: { contents: execFileSync("git", ["show", `${BASELINE}:${file}`], { encoding: "utf8" }), resolveDir: path.dirname(path.join(root, file)), sourcefile: file, loader: "ts" }, outfile, bundle: true, platform: "node", format: "cjs", packages: "external", logLevel: "silent",
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
  seed: await route("src/lib/seed-set.ts", "seed"),
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

// These intentionally document pre-fix behavior of the exact deployed commit.
test("deployed Bava Kamma rename already works: historical failure is not reproduced", async () => {
  setup(); const result = await (await routes.single.POST(request(basic))).json();
  assert.equal((await routes.manage.PATCH(request({ idToken: "owner", userName: "Replacement" }), context(result.claimId))).status, 200);
  assert.equal(state.db.data("lzecher_portions", "one")!.claimedByName, "Replacement");
});
test("deployed multi reservation permits two winners for the same exclusive portions", async () => {
  setup(); const responses = await Promise.all(["First", "Second"].map(claimerName => routes.multi.POST(request({ ...basic, portionIds: ["one", "two"], claimerName }))));
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  assert.equal((await state.db.collection("lzecher_claims").get()).docs.filter(d => !d.data()!.isParent).length, 4);
});
test("deployed daily retries increment progress twice", async () => {
  setup(); state.db.put("lzecher_claims", "daily", { projectId: "p", userId: "learner", duration: "daily", status: "active", progress: { completed: 0, total: 3 } });
  const body = { projectId: "p", claimId: "daily", checkIn: true, idToken: "learner" };
  await routes.complete.POST(request(body)); await routes.complete.POST(request(body));
  assert.equal(state.db.data("lzecher_claims", "daily")!.progress.completed, 2);
});
test("deployed missing scope ID broadens completion to all caller claims", async () => {
  setup(); await routes.single.POST(request(basic));
  const response = await routes.bulkComplete.POST(request({ projectId: "p", scope: "masechta", idToken: "learner" }));
  assert.equal((await response.json()).completedCount, 1);
});
test("deployed bulk completion changes an inclusive shared portion to completed", async () => {
  setup(); state.db.put("lzecher_portions", "inclusive", { projectId: "p", trackType: "kabalos", claimMode: "inclusive", status: "available", reference: "Kindness" });
  await routes.single.POST(request({ ...basic, portionId: "inclusive" }));
  await routes.bulkComplete.POST(request({ projectId: "p", scope: "all_my_claims_in_project", idToken: "learner" }));
  assert.equal(state.db.data("lzecher_portions", "inclusive")!.status, "completed");
});
test("deployed reminder GET mutates the commitment", async () => {
  setup(); const result = await (await routes.single.POST(request(basic))).json();
  const token = signToken({ purpose: "mark_complete", claimId: result.claimId }, TTL.MARK_COMPLETE);
  await routes.emailComplete.GET(new NextRequest(`http://localhost/api/claims/mark-complete-via-link?token=${token}`));
  assert.equal(state.db.data("lzecher_portions", "one")!.status, "completed");
});
test("deployed protected-project reservation bypasses the password gate", async () => {
  setup(); state.db.put("lzecher_projects", "p", { status: "active", passwordHash: "synthetic", createdBy: "owner" });
  assert.equal((await routes.single.POST(request(basic))).status, 200);
});
test("deployed stale parent reminder completes a replacement participant's portion", async () => {
  setup(); const parent = await (await routes.bulk.POST(request({ ...basic, scope: "shas" }))).json();
  const first = (await state.db.collection("lzecher_claims").get()).docs.find(d => d.data()!.portionId === "one")!;
  await routes.manage.DELETE(request({ idToken: "owner" }), context(first.id));
  await routes.single.POST(request({ ...basic, idToken: "outsider", claimerName: "Other" }));
  const token = signToken({ purpose: "mark_complete", claimId: parent.parentClaimId }, TTL.MARK_COMPLETE);
  await routes.emailComplete.GET(new NextRequest(`http://localhost/api/claims/mark-complete-via-link?token=${token}`));
  assert.equal(state.db.data("lzecher_portions", "one")!.status, "completed");
});

test("deployed overview returns stats even to an admin without stats permission", async () => {
  setup(); state.db.put("lzecher_users", "admin", { isAdmin: true, permissions: [] });
  const response = await routes.overview.POST(request({ idToken: "admin" }));
  assert.equal(response.status, 200); const overview = await response.json();
  assert.equal(overview.role.access.stats, false); assert.equal(overview.stats.totalProjects, 1);
});


test("deployed concurrent set seeds duplicate the next round", async () => {
  setup(); await Promise.all([routes.seed.seedSetForTrack(state.db,"p","tehillim",2),routes.seed.seedSetForTrack(state.db,"p","tehillim",2)]);
  const seeded = (await state.db.collection("lzecher_portions").where("trackType","==","tehillim").get()).size;
  assert.equal(seeded,300);
});
