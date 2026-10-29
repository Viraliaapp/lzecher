import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { MemoryFirestore } from "./support/fake-firestore";
import { reserveClaims } from "../../src/lib/claim-writes";
import { getRecentActivity } from "../../src/lib/recent-activity";
import { unitLabel } from "../../src/lib/activity-format";

const baseline = "9eeb42ef5db65eb69f30f60fd2e199b79a641646";
const previous = "a9ea2afff49c71b2c6ead02fef185af78c17a9cd";
const now = 1793012400000;
const values = { userId: "anonymous", userName: "Learner", claimedAt: now, status: "active" };
const state = { db: new MemoryFirestore() };
Object.assign(globalThis, { __activityBaseline: state });
const require = createRequire(import.meta.url);
let oldRoute: { GET: () => Promise<Response> }, oldFormat: { unitLabel: typeof unitLabel };
before(async () => {
  const output = path.resolve("test-results/activity-baseline"); fs.mkdirSync(output, { recursive: true });
  for (const [file, name] of [["src/app/api/activity/recent/route.ts", "route"], ["src/lib/activity-format.ts", "format"]]) {
    const source = execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" });
    assert.equal(source, execFileSync("git", ["show", `${previous}:${file}`], { encoding: "utf8" }), "Defect source predates the last release");
    const outfile = path.join(output, `${name}.cjs`);
    await build({ stdin: { contents: source, loader: "ts", resolveDir: path.resolve(path.dirname(file)) },
      bundle: true, platform: "node", format: "cjs", packages: "external", outfile,
      plugins: [{ name: "synthetic-database-only", setup(builder) {
        builder.onResolve({ filter: /firebase\/admin$/ }, () => ({ path: "admin", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const getAdminDb=()=>globalThis.__activityBaseline.db.asFirestore()", loader: "js" }));
      } }] });
    if (name === "route") oldRoute = require(outfile); else oldFormat = require(outfile);
  }
});
function fixture(count: number) {
  const db = new MemoryFirestore().put("lzecher_projects", "p", { status: "active", nameHebrew: "Fixture" });
  for (let n = 0; n < count; n++) db.put("lzecher_portions", `p-${n}`, { projectId: "p", trackType: "mishnayos", status: "available", reference: `Chapter ${n+1}` });
  state.db = db; return db;
}
test("before/after: exact released route truncates 525-child reservation; fixed route counts 525", async () => {
  const db = fixture(525);
  await reserveClaims(db.asFirestore(), "p", Array.from({ length: 525 }, (_, n) => `p-${n}`), values, { access: true, parentId: "group", parent: { scope: "shas" } });
  const old = await (await oldRoute.GET()).json();
  assert.equal(old.events.length, 1); assert.ok(old.events[0].count <= 80); assert.ok(old.events[0].count < 525);
  assert.equal((await getRecentActivity(db.asFirestore(), now))[0].count, 525);
});
test("before/after: exact released route merges distinct same-second reservations; fixed preserves both identities", async () => {
  const db = fixture(2);
  for (const id of ["p-0", "p-1"]) await reserveClaims(db.asFirestore(), "p", [id], values, { access: true });
  const old = await (await oldRoute.GET()).json(); assert.equal(old.events.length, 1); assert.equal(old.events[0].count, 2);
  const fixed = await getRecentActivity(db.asFirestore(), now); assert.equal(fixed.length, 2);
  assert.deepEqual(fixed.map(e => e.count), [1, 1]); assert.notEqual(fixed[0].id, fixed[1].id);
});
test("before/after: both released and fixed routes retain the latest 25-hour-old activity", async () => {
  const db = fixture(1);
  await reserveClaims(db.asFirestore(), "p", ["p-0"], { ...values, claimedAt: now - 25 * 3600000 }, { access: true });
  assert.equal((await (await oldRoute.GET()).json()).events.length, 1);
  const fixed = await getRecentActivity(db.asFirestore(), now);
  assert.equal(fixed.length, 1); assert.equal(fixed[0].claimedAt, now - 25 * 3600000);
});
test("before/after: exact released formatter calls a chapter one Mishnah; fixed identifies chapter units", () => {
  assert.equal(oldFormat.unitLabel("mishnayos", 1, "en"), "1 Mishnah");
  assert.equal(unitLabel("mishnayos", 1, "en"), "1 perek of Mishnayos");
  for (const locale of ["en", "he", "es", "fr"]) assert.notEqual(oldFormat.unitLabel("mishnayos", 2, locale), unitLabel("mishnayos", 2, locale));
});
