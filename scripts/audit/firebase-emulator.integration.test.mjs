import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { NextRequest } from 'next/server';
import { deleteApp, getApps } from 'firebase-admin/app';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
// The repository is CommonJS; tsx's require hook loads its TypeScript modules.
const { getAdminDb, getAdminAuth } = require('./src/lib/firebase/admin.ts');
const { reserveClaims } = require('./src/lib/claim-writes.ts');
const { completePortion, checkInClaim } = require('./src/lib/claim-completion.ts');
const { seedSetForTrack } = require('./src/lib/seed-set.ts');
const { signToken, TTL } = require('./src/lib/signed-tokens.ts');
const toolsRequire = createRequire(path.join(process.env.LZECHER_EMULATOR_TOOLS, 'package.json'));
const { initializeTestEnvironment, assertFails, assertSucceeds } = toolsRequire('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc } = toolsRequire('firebase/firestore');
const BASELINE = 'a9ea2afff49c71b2c6ead02fef185af78c17a9cd';
const PROJECT = 'demo-lzecher-audit';
const evidence = { project: PROJECT, firestore: '127.0.0.1:8089', auth: '127.0.0.1:9099', baseline: BASELINE, observations: [] };
for (const key of ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT']) assert.equal(process.env[key], PROJECT);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, evidence.firestore);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, evidence.auth);
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_ADMIN_PRIVATE_KEY', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_SERVICE_ACCOUNT', 'RESEND_API_KEY', 'UPSTASH_REDIS_REST_URL']) assert.ok(!process.env[key], `External credential/config must be unset: ${key}`);
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Test fetch must remain on loopback');
  return realFetch(input, init);
};
const output = path.join(root, 'test-results/emulator');
fs.mkdirSync(output, { recursive: true });
const state = { cookies: new Map(), queued: [] };
globalThis.__lzecherEmulator = state;
const stubs = {
  'next/headers': `export const cookies=async()=>({get:key=>{const value=globalThis.__lzecherEmulator.cookies.get(key);return value?{value}:undefined;}});`,
  '@/lib/queue-reminders': `export const sanitizeReminderPreferences=v=>Array.isArray(v)?v:[];export const normalizeFutureTimestamp=(v,now)=>typeof v==='number'&&v>now?v:null;export const queueRemindersForClaim=async()=>{globalThis.__lzecherEmulator.queued.push(true);throw new Error('Email delivery disabled in emulator tests')};`,
};
async function loadRoute(file, label, baseline = false) {
  const outfile = path.join(output, `${label}${baseline ? '-deployed' : ''}.cjs`);
  await build({ ...(baseline ? { stdin: { contents: execFileSync('git', ['show', `${BASELINE}:${file}`], { cwd: root, encoding: 'utf8' }), sourcefile: file, resolveDir: path.dirname(path.join(root, file)), loader: 'ts' } } : { entryPoints: [path.join(root, file)] }),
    outfile, bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', tsconfig: path.join(root, 'tsconfig.json'),
    plugins: [{ name: 'no-outbound-effects', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => stubs[args.path] ? { path: args.path, namespace: 'emulator-stub' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'emulator-stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
      // Replay repository dependencies from the same deployed commit as the route.
      // Third-party SDKs remain the candidate's installed versions for both runs.
      if (baseline) builder.onLoad({ filter: /\.(ts|tsx|json)$/ }, args => {
        const relative = path.relative(root, args.path).split(path.sep).join('/');
        if (!relative.startsWith('src/') && !relative.startsWith('messages/')) return undefined;
        return { contents: execFileSync('git', ['show', `${BASELINE}:${relative}`], { cwd: root, encoding: 'utf8' }), loader: path.extname(args.path).slice(1), resolveDir: path.dirname(args.path) };
      });
    } }],
  });
  return require(outfile);
}
let db, auth, rulesEnv, routes, deployed;
const tokens = {};
const runId = randomUUID().slice(0, 8);
const uid = role => `audit-${runId}-${role}`;
function request(body) { return new NextRequest('http://127.0.0.1/api/audit', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }); }
function context(id, claimId) { return { params: Promise.resolve({ id, claimId }) }; }
async function fixture(mode = 'exclusive') {
  state.cookies.clear();
  const id = `audit-${randomUUID()}`, portionId = `${id}-one`, secondId = `${id}-two`;
  await db.collection('lzecher_projects').doc(id).set({ status: 'active', createdBy: uid('owner'), nameHebrew: 'Synthetic audit', slug: id, tracks: [mode === 'inclusive' ? 'kabalos' : 'mishnayos'], totalPortions: 2, repeatingSetEnabled: false });
  for (const item of [portionId, secondId]) await db.collection('lzecher_portions').doc(item).set({ projectId: id, trackType: mode === 'inclusive' ? 'kabalos' : 'mishnayos', claimMode: mode, reference: 'Bava Kamma 1', masechet: 'Bava Kamma', status: 'available' });
  return { id, portionId, secondId, body: { projectId: id, portionId, claimerName: 'Synthetic learner', idToken: tokens.learner } };
}
async function claimDocs(id) { return (await db.collection('lzecher_claims').where('projectId', '==', id).get()).docs; }
before(async () => {
  db = getAdminDb(); db.settings({ host: evidence.firestore, ssl: false });
  assert.equal(db.projectId, PROJECT); auth = getAdminAuth(); assert.equal(auth.app.options.projectId, PROJECT);
  rulesEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync(path.join(root, 'firebase/lzecher-firestore.rules'), 'utf8') } });
  for (const role of ['owner', 'learner', 'outsider', 'admin']) {
    const email = `${uid(role)}@example.test`, password = `synthetic-${runId}-password`;
    await auth.createUser({ uid: uid(role), email, password });
    if (role === 'admin') await auth.setCustomUserClaims(uid(role), { isAdmin: true, lzecherPermissions: ['projects'] });
    const response = await fetch(`http://${evidence.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-api-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    assert.equal(response.status, 200); tokens[role] = (await response.json()).idToken;
    assert.equal((await auth.verifyIdToken(tokens[role])).uid, uid(role));
  }
  routes = {}; deployed = {};
  routes.activity = await loadRoute('src/app/api/activity/recent/route.ts', 'activity');
  for (const [name, file] of Object.entries({ single: 'src/app/api/claims/route.ts', multi: 'src/app/api/claims/multi/route.ts', bulk: 'src/app/api/claims/bulk/route.ts', complete: 'src/app/api/claims/complete/route.ts', manage: 'src/app/api/projects/[id]/claims/[claimId]/route.ts', batch: 'src/app/api/claims/complete-batch/route.ts', bulkComplete: 'src/app/api/claims/complete-bulk/route.ts', email: 'src/app/api/claims/mark-complete-via-link/route.ts' })) {
    routes[name] = await loadRoute(file, name);
    if (['single', 'multi', 'bulk', 'complete', 'manage'].includes(name)) deployed[name] = await loadRoute(file, name, true);
  }
}, { timeout: 120000 });
after(async () => {
  evidence.reminderQueueCalls = state.queued.length;
  fs.writeFileSync(path.join(output, 'observations.json'), JSON.stringify(evidence, null, 2));
  if (rulesEnv) await rulesEnv.cleanup();
  if (db) await db.terminate();
  await Promise.all(getApps().map(app => deleteApp(app)));
  assert.equal(state.queued.length, 0, 'No test may request reminder delivery');
});

test('activity: real bulk reservation yields exact chapter count beyond the 80-document feed window', { timeout: 90000 }, async () => {
  const f = await fixture();
  const batch = db.batch();
  for (let n = 2; n < 120; n++) batch.set(db.collection('lzecher_portions').doc(`${f.id}-${n}`), {
    projectId: f.id, trackType: 'mishnayos', claimMode: 'exclusive', reference: `Bava Kamma ${n + 1}`,
    masechet: 'Bava Kamma', status: 'available',
  });
  await batch.commit();
  const reserved = await routes.bulk.POST(request({ ...f.body, scope: 'masechta', scopeId: 'Bava Kamma' }));
  assert.equal(reserved.status, 200); assert.equal((await reserved.json()).claimedCount, 120);
  const response = await routes.activity.GET(); assert.equal(response.status, 200);
  const events = (await response.json()).events.filter(e => e.projectId === f.id);
  assert.equal(events.length, 1); assert.equal(events[0].count, 120);
  assert.equal(events[0].trackType, 'mishnayos'); assert.equal('userEmail' in events[0], false);
  const child = (await claimDocs(f.id)).find(d => !d.data().isParent);
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.owner, userName: 'Renamed fixture' }), context(f.id, child.id))).status, 200);
  const renamed = (await (await routes.activity.GET()).json()).events.filter(e => e.projectId === f.id);
  assert.equal(renamed.reduce((sum, e) => sum + e.count, 0), 120);
  assert.equal(renamed.find(e => e.name === 'Renamed fixture').count, 1);
    const oldAt = Date.now() - 365 * 24 * 3600000;
    const aging = db.batch();
    for (const claim of await claimDocs(f.id)) aging.update(claim.ref, { claimedAt: oldAt });
    await aging.commit();
    const oldEvents = (await (await routes.activity.GET()).json()).events.filter(e => e.projectId === f.id);
    assert.equal(oldEvents.reduce((sum, e) => sum + e.count, 0), 120);
    assert.ok(oldEvents.every(e => e.claimedAt === oldAt));
  evidence.observations.push({ check: 'bulk-to-popup contract', reserved: 120, popupCount: 120, renamedCount: 1 });
    evidence.observations.push({ check: 'year-old activity retained', popupCount: 120, timestampPreserved: true });
});

test('rules: anonymous and authenticated clients cannot directly read or mutate commitments', { timeout: 90000 }, async () => {
  const f = await fixture();
  for (const client of [rulesEnv.unauthenticatedContext().firestore(), rulesEnv.authenticatedContext(uid('owner')).firestore()]) {
    for (const [collection, id] of [['lzecher_projects', f.id], ['lzecher_portions', f.portionId], ['lzecher_claims', `${f.id}-claim`]]) {
      await assertFails(getDoc(doc(client, collection, id)));
      await assertFails(setDoc(doc(client, collection, id), { projectId: f.id, status: 'completed' }));
    }
  }
  await db.collection('lzecher_settings').doc('site').set({ fixture: true });
  await assertSucceeds(getDoc(doc(rulesEnv.unauthenticatedContext().firestore(), 'lzecher_settings', 'site')));
});

test('rules: own profile create/update allowed; foreign access and privilege writes denied', { timeout: 90000 }, async () => {
  const client = rulesEnv.authenticatedContext(uid('owner')).firestore();
  const own = doc(client, 'lzecher_users', uid('owner'));
  await assertSucceeds(setDoc(own, { uid: uid('owner'), email: 'audit@example.test', displayName: null, photoURL: null, createdAt: Date.now(), language: 'en' }, { merge: true }));
  await assertSucceeds(updateDoc(own, { displayName: 'Synthetic updated name' }));
  await assertFails(updateDoc(own, { isAdmin: true }));
  await assertFails(updateDoc(own, { permissions: ['projects'] }));
  await assertFails(getDoc(doc(client, 'lzecher_users', uid('learner'))));
  await assertFails(setDoc(doc(client, 'lzecher_users', uid('learner')), { uid: uid('learner') }));
  // Verify the old first-login shape conflicts with the included rules.
  const fresh = `${uid('owner')}-fresh`, freshDb = rulesEnv.authenticatedContext(fresh).firestore();
  await assertFails(setDoc(doc(freshDb, 'lzecher_users', fresh), { id: fresh, uid: fresh, totalClaimed: 0, totalCompleted: 0, projectsCreated: 0, projectsContributed: [] }));
});

test('real Auth tokens: invalid token and non-owner management denied; owner rename succeeds', { timeout: 90000 }, async () => {
  const f = await fixture();
  assert.equal((await routes.single.POST(request({ ...f.body, idToken: 'invalid-token' }))).status, 401);
  const response = await routes.single.POST(request(f.body)); assert.equal(response.status, 200); const { claimId } = await response.json();
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.outsider, userName: 'Replacement' }), context(f.id, claimId))).status, 403);
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.owner, userName: 'Replacement' }), context(f.id, claimId))).status, 200);
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().claimedByName, 'Replacement');
  await db.collection('lzecher_users').doc(uid('admin')).set({ uid: uid('admin'), isAdmin: true, permissions: [] });
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.admin, userName: 'Denied' }), context(f.id, claimId))).status, 403);
  await db.collection('lzecher_users').doc(uid('admin')).update({ permissions: ['projects'] });
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.admin, userName: 'Permitted' }), context(f.id, claimId))).status, 200);
});

test('protected project: missing/forged cookies fail; correctly signed access cookie works', { timeout: 90000 }, async () => {
  const f = await fixture(); await db.collection('lzecher_projects').doc(f.id).update({ passwordHash: 'synthetic' });
  for (const value of ['', 'forged']) { state.cookies.set(`lz_access_${f.id}`, value); assert.equal((await routes.single.POST(request(f.body))).status, 403); }
  state.cookies.set(`lz_access_${f.id}`, signToken({ purpose: 'project_access', projectId: f.id }, TTL.PROJECT_ACCESS));
  assert.equal((await routes.single.POST(request(f.body))).status, 200);
});

test('concurrent real Firestore single/multi reservation has one exclusive winner', { timeout: 90000 }, async () => {
  const f = await fixture();
  const responses = await Promise.all([routes.single.POST(request(f.body)), routes.multi.POST(request({ ...f.body, portionIds: [f.portionId], claimerName: 'Other synthetic learner', idToken: tokens.outsider }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const children = (await claimDocs(f.id)).filter(d => !d.data().isParent); assert.equal(children.length, 1);
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().claimId, children[0].id);
});

test('multi versus multi race and repeated request preserve committed ownership', { timeout: 90000 }, async () => {
  const f = await fixture(); const body = { ...f.body, portionIds: [f.portionId, f.secondId] };
  const responses = await Promise.all([routes.multi.POST(request(body)), routes.multi.POST(request({ ...body, claimerName: 'Contender', idToken: tokens.outsider }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await routes.multi.POST(request(body))).status, 409);
  const docs = await claimDocs(f.id); assert.equal(docs.filter(d => !d.data().isParent).length, 2); assert.equal(docs.filter(d => d.data().isParent).length, 1);
});

test('concurrent and duplicate daily check-ins count once; another user cannot check in', { timeout: 90000 }, async () => {
  const f = await fixture('inclusive'), claimId = `${f.id}-daily`;
  await db.collection('lzecher_claims').doc(claimId).set({ projectId: f.id, portionId: f.portionId, userId: uid('learner'), duration: 'daily', status: 'active', progress: { completed: 0, total: 3 } });
  const body = { projectId: f.id, claimId, checkIn: true, idToken: tokens.learner };
  const responses = await Promise.all([1, 2, 3].map(() => routes.complete.POST(request(body))));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal((await routes.complete.POST(request({ ...body, idToken: tokens.outsider }))).status, 403);
  assert.equal((await db.collection('lzecher_claims').doc(claimId).get()).data().progress.completed, 1);
});

test('completion rejects mismatched IDs and stale claim IDs; repeat completion stays synchronized', { timeout: 90000 }, async () => {
  const f = await fixture(); const created = await (await routes.single.POST(request(f.body))).json();
  const other = await fixture(); const foreign = await (await routes.single.POST(request(other.body))).json();
  const body = { projectId: f.id, portionId: f.portionId, idToken: tokens.learner };
  assert.equal((await routes.complete.POST(request({ ...body, claimId: foreign.claimId }))).status, 400);
  const stale = `${f.id}-stale`; await db.collection('lzecher_claims').doc(stale).set({ projectId: f.id, portionId: f.portionId, userId: uid('learner'), claimedAt: 1, status: 'active' });
  assert.equal((await routes.complete.POST(request({ ...body, claimId: stale }))).status, 409);
  for (const response of await Promise.all([1, 2].map(() => routes.complete.POST(request({ ...body, claimId: created.claimId }))))) assert.equal(response.status, 200);
  assert.equal((await db.collection('lzecher_claims').doc(created.claimId).get()).data().status, 'completed');
  assert.equal((await db.collection('lzecher_claims').doc(stale).get()).data().status, 'active');
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().status, 'completed');
});

test('aborted completion transaction rolls back both linked documents', { timeout: 90000 }, async () => {
  const f = await fixture(); await routes.single.POST(request(f.body));
  const abortDb = new Proxy(db, { get(target, key) { if (key === 'runTransaction') return fn => target.runTransaction(async tx => { await fn(tx); throw new Error('Injected pre-commit interruption'); }); const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
  await assert.rejects(completePortion(abortDb, f.id, f.portionId, { uid: uid('learner'), name: null }, false), /Injected/);
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().status, 'claimed');
  assert.equal((await claimDocs(f.id))[0].data().status, 'active');
});

test('525-portion interrupted reservation keeps committed parent IDs and safely resumes', { timeout: 90000 }, async () => {
  const f = await fixture(); const ids = Array.from({ length: 525 }, (_, i) => `${f.id}-bulk-${i}`), parentId = `${f.id}-parent`;
  for (let offset = 0; offset < ids.length; offset += 250) { const batch = db.batch(); for (const id of ids.slice(offset, offset + 250)) batch.set(db.collection('lzecher_portions').doc(id), { projectId: f.id, trackType: 'mishnayos', status: 'available' }); await batch.commit(); }
  const values = { userId: uid('learner'), userName: 'Synthetic bulk', claimedAt: 123, status: 'active', duration: 'oneTime' }, options = { access: false, parentId, parent: { scope: 'shas' } };
  let calls = 0; const interrupted = new Proxy(db, { get(target, key) { if (key === 'runTransaction') return fn => { if (++calls === 2) throw new Error('Injected chunk interruption'); return target.runTransaction(fn); }; const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
  await assert.rejects(reserveClaims(interrupted, f.id, ids, values, options), /Injected/);
  assert.equal((await db.collection('lzecher_claims').doc(parentId).get()).data().portionIds.length, 200);
  assert.equal((await reserveClaims(db, f.id, ids, values, options)).length, 325);
  assert.equal((await db.collection('lzecher_claims').doc(parentId).get()).data().portionIds.length, 525);
  assert.equal((await claimDocs(f.id)).filter(d => !d.data().isParent).length, 525);
});

test('concurrent Tehillim round seeding produces exactly 150 unique portions', { timeout: 90000 }, async () => {
  const f = await fixture(); await Promise.all([seedSetForTrack(db, f.id, 'tehillim', 2), seedSetForTrack(db, f.id, 'tehillim', 2)]);
  const seeded = await db.collection('lzecher_portions').where('projectId', '==', f.id).where('trackType', '==', 'tehillim').get(); assert.equal(seeded.size, 150);
});

test('inclusive repeated reservations and same-name management preserve entry counts', { timeout: 90000 }, async () => {
  const f = await fixture('inclusive');
  const body = { ...f.body, duration: 'daily', durationValue: 3 };
  const responses = await Promise.all([routes.single.POST(request(body)), routes.single.POST(request(body))]);
  // Inclusive creation has no request-idempotency contract. Preserve the deployed
  // multiple-entry behavior; each accepted request must be reflected exactly once.
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 200]);
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().currentClaimerCount, 2);
  assert.equal((await routes.single.POST(request({ ...body, idToken: tokens.outsider }))).status, 200);
  const claims = await claimDocs(f.id); assert.equal(claims.length, 3);
  const first = claims.find(d => d.data().userId === uid('learner'));
  assert.equal((await routes.manage.PATCH(request({ idToken: tokens.owner, userName: 'Renamed participant' }), context(f.id, first.id))).status, 200);
  assert.deepEqual((await db.collection('lzecher_portions').doc(f.portionId).get()).data().claimerNames.sort(), ['Renamed participant', 'Synthetic learner', 'Synthetic learner']);
  const deleted = await Promise.all([1, 2].map(() => routes.manage.DELETE(request({ idToken: tokens.owner }), context(f.id, first.id))));
  assert.ok(deleted.every(r => r.status === 200));
  const portion = (await db.collection('lzecher_portions').doc(f.portionId).get()).data();
  assert.equal(portion.currentClaimerCount, 2); assert.deepEqual(portion.claimerNames, ['Synthetic learner', 'Synthetic learner']);
});

test('weekly check-in boundary and final-completion retry count exactly once', { timeout: 90000 }, async () => {
  const f = await fixture('inclusive'), claimId = `${f.id}-weekly`, now = Date.UTC(2026, 9, 25, 12);
  const ref = db.collection('lzecher_claims').doc(claimId);
  await ref.set({ projectId: f.id, userId: uid('learner'), duration: 'weekly', status: 'active', progress: { completed: 0, total: 2 } });
  await checkInClaim(db, f.id, claimId, uid('learner'), now);
  await checkInClaim(db, f.id, claimId, uid('learner'), now + 7 * 86400000 - 1);
  assert.equal((await ref.get()).data().progress.completed, 1);
  await Promise.all([1, 2].map(() => checkInClaim(db, f.id, claimId, uid('learner'), now + 7 * 86400000)));
  await checkInClaim(db, f.id, claimId, uid('learner'), now + 7 * 86400000 + 1);
  assert.equal((await ref.get()).data().progress.completed, 2); assert.equal((await ref.get()).data().status, 'completed');
});

test('exclusive rename/reset race cannot leave a renamed available portion; retry preserves replacement', { timeout: 90000 }, async () => {
  const f = await fixture(); const { claimId } = await (await routes.single.POST(request(f.body))).json();
  const responses = await Promise.all([
    routes.manage.PATCH(request({ idToken: tokens.owner, userName: 'Concurrent name' }), context(f.id, claimId)),
    routes.manage.DELETE(request({ idToken: tokens.owner }), context(f.id, claimId)),
  ]);
  assert.ok([200, 404].includes(responses[0].status)); assert.equal(responses[1].status, 200);
  const portion = (await db.collection('lzecher_portions').doc(f.portionId).get()).data();
  assert.equal(portion.status, 'available'); assert.equal(portion.claimedByName, null); assert.equal(portion.claimId, null);
  const replacement = await (await routes.single.POST(request({ ...f.body, idToken: tokens.outsider, claimerName: 'Replacement learner' }))).json();
  assert.equal((await routes.manage.DELETE(request({ idToken: tokens.owner }), context(f.id, claimId))).status, 200);
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().claimId, replacement.claimId);
});

test('bulk reservations race safely and scoped bulk/batch completion preserves inclusive portions', { timeout: 90000 }, async () => {
  const f = await fixture(), body = { ...f.body, scope: 'masechta', scopeId: 'Bava Kamma' };
  assert.equal((await routes.bulk.POST(request({ ...body, scopeId: undefined }))).status, 400);
  const responses = await Promise.all([routes.bulk.POST(request(body)), routes.bulk.POST(request({ ...body, idToken: tokens.outsider }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const children = (await claimDocs(f.id)).filter(d => !d.data().isParent); assert.equal(children.length, 2);
  const winner = children[0].data().userId === uid('learner') ? tokens.learner : tokens.outsider;
  assert.equal((await routes.bulkComplete.POST(request({ projectId: f.id, scope: 'masechta', idToken: winner }))).status, 400);
  const completeBody = { projectId: f.id, scope: 'masechta', scopeId: 'Bava Kamma', idToken: winner };
  const completed = await Promise.all([1, 2].map(() => routes.bulkComplete.POST(request(completeBody))));
  assert.ok(completed.every(r => r.status === 200));
  assert.equal((await routes.batch.POST(request({ projectId: f.id, portionIds: [f.portionId, f.portionId, f.secondId], idToken: winner }))).status, 200);
  for (const doc of children) assert.equal((await doc.ref.get()).data().status, 'completed');
  const inclusive = await fixture('inclusive'); const created = await (await routes.single.POST(request(inclusive.body))).json();
  const result = await routes.bulkComplete.POST(request({ projectId: inclusive.id, scope: 'all_my_claims_in_project', idToken: tokens.learner }));
  assert.equal(result.status, 200); assert.equal((await result.json()).completedCount, 1);
  assert.equal((await db.collection('lzecher_claims').doc(created.claimId).get()).data().status, 'completed');
  assert.equal((await db.collection('lzecher_portions').doc(inclusive.portionId).get()).data().status, 'available');
});

test('signed email GET is read-only; POST and retry complete current children only', { timeout: 90000 }, async () => {
  const f = await fixture();
  assert.equal((await routes.multi.POST(request({ ...f.body, portionIds: [f.portionId, f.secondId] }))).status, 200);
  const claims = await claimDocs(f.id), parent = claims.find(d => d.data().isParent), removed = claims.find(d => d.data().portionId === f.portionId);
  const token = signToken({ purpose: 'mark_complete', claimId: parent.id }, TTL.MARK_COMPLETE);
  const get = await routes.email.GET(new NextRequest(`http://127.0.0.1/api/claims/mark-complete-via-link?token=${encodeURIComponent(token)}&locale=he`));
  assert.equal(get.status, 303); assert.equal(new URL(get.headers.get('location')).searchParams.get('status'), 'confirm');
  assert.equal(get.headers.get('cache-control'), 'no-store');
  for (const doc of claims) assert.equal((await doc.ref.get()).data().status, 'active');
  assert.equal((await routes.manage.DELETE(request({ idToken: tokens.owner }), context(f.id, removed.id))).status, 200);
  const replacement = await (await routes.single.POST(request({ ...f.body, idToken: tokens.outsider }))).json();
  const post = tokenValue => routes.email.POST(new NextRequest('http://127.0.0.1/api/claims/mark-complete-via-link', { method: 'POST', body: new URLSearchParams({ token: tokenValue, locale: 'he' }) }));
  const bad = await post(signToken({ purpose: 'email_signin', claimId: parent.id }, TTL.EMAIL_SIGNIN));
  assert.equal(new URL(bad.headers.get('location')).searchParams.get('status'), 'expired');
  const confirmed = await post(token); assert.equal(confirmed.status, 303); assert.equal(new URL(confirmed.headers.get('location')).searchParams.get('status'), 'success');
  assert.equal(new URL((await post(token)).headers.get('location')).searchParams.get('status'), 'already_complete');
  assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().status, 'claimed');
  assert.equal((await db.collection('lzecher_claims').doc(replacement.claimId).get()).data().status, 'active');
  assert.equal((await db.collection('lzecher_portions').doc(f.secondId).get()).data().status, 'completed');
});

test('exact deployed single reservation already has one winner and individual rename works', { timeout: 90000 }, async () => {
  const f = await fixture();
  const responses = await Promise.all([deployed.single.POST(request(f.body)), deployed.single.POST(request({ ...f.body, idToken: tokens.outsider }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const claims = await claimDocs(f.id); assert.equal(claims.length, 1);
  const renamed = await deployed.manage.PATCH(request({ idToken: tokens.owner, userName: 'Another participant name' }), context(f.id, claims[0].id));
  assert.equal(renamed.status, 200); assert.equal((await db.collection('lzecher_portions').doc(f.portionId).get()).data().claimedByName, 'Another participant name');
  evidence.observations.push({ check: 'single reservation and Bava Kamma rename', baselineStatuses: responses.map(r => r.status).sort(), baselineRenameStatus: 200 });
  const inclusive = await fixture('inclusive');
  const repeated = await Promise.all([1, 2].map(() => deployed.single.POST(request({ ...inclusive.body, duration: 'daily', durationValue: 3 }))));
  assert.ok(repeated.every(r => r.status === 200));
  assert.equal((await claimDocs(inclusive.id)).length, 2);
  assert.equal((await db.collection('lzecher_portions').doc(inclusive.portionId).get()).data().currentClaimerCount, 2);
  evidence.observations.push({ check: 'inclusive creation has no request idempotency', baselineRepeatedStatuses: [200, 200], baselineEntries: 2, fixedRepeatedStatuses: [200, 200], fixedEntries: 2 });
});

test('exact deployed baseline already rejects foreign completion IDs but accepts stale same-portion IDs', { timeout: 90000 }, async () => {
  const f = await fixture(), other = await fixture();
  await deployed.single.POST(request(f.body)); const foreign = await (await deployed.single.POST(request(other.body))).json();
  const body = { projectId: f.id, portionId: f.portionId, idToken: tokens.learner };
  assert.equal((await deployed.complete.POST(request({ ...body, claimId: foreign.claimId }))).status, 400);
  const stale = `${f.id}-stale`; await db.collection('lzecher_claims').doc(stale).set({ projectId: f.id, portionId: f.portionId, userId: uid('learner'), claimedAt: 1, status: 'active' });
  assert.equal((await deployed.complete.POST(request({ ...body, claimId: stale }))).status, 200);
  evidence.observations.push({ check: 'completion IDs', baselineForeignIDStatus: 400, baselineStaleSamePortionStatus: 200, fixedForeignIDStatus: 400, fixedStaleSamePortionStatus: 409 });
});

test('exact deployed baseline increments repeated check-ins twice on real Firestore', { timeout: 90000 }, async () => {
  const f = await fixture('inclusive'), claimId = `${f.id}-daily`;
  await db.collection('lzecher_claims').doc(claimId).set({ projectId: f.id, userId: uid('learner'), duration: 'daily', status: 'active', progress: { completed: 0, total: 3 } });
  const body = { projectId: f.id, claimId, checkIn: true, idToken: tokens.learner };
  await deployed.complete.POST(request(body)); await deployed.complete.POST(request(body));
  assert.equal((await db.collection('lzecher_claims').doc(claimId).get()).data().progress.completed, 2);
  evidence.observations.push({ check: 'repeated check-in', baselineCount: 2, fixedCount: 1 });
});

test('exact deployed multi reservation race creates duplicate claims on real Firestore', { timeout: 90000 }, async () => {
  const f = await fixture(); const body = { ...f.body, portionIds: [f.portionId, f.secondId] };
  const responses = await Promise.all([deployed.multi.POST(request(body)), deployed.multi.POST(request({ ...body, claimerName: 'Baseline contender', idToken: tokens.outsider }))]);
  const statuses = responses.map(r => r.status); const children = (await claimDocs(f.id)).filter(d => !d.data().isParent);
  assert.deepEqual(statuses, [200, 200]); assert.equal(children.length, 4);
  evidence.observations.push({ check: 'multi reservation race', baselineStatuses: statuses, baselineChildClaims: children.length, fixedStatuses: [200, 409], fixedChildClaims: 2 });
});

test('exact deployed bulk reservation race also creates duplicate claims', { timeout: 90000 }, async () => {
  const f = await fixture(); const body = { ...f.body, scope: 'masechta', scopeId: 'Bava Kamma' };
  const responses = await Promise.all([deployed.bulk.POST(request(body)), deployed.bulk.POST(request({ ...body, idToken: tokens.outsider }))]);
  const statuses = responses.map(r => r.status), children = (await claimDocs(f.id)).filter(d => !d.data().isParent);
  assert.deepEqual(statuses, [200, 200]); assert.equal(children.length, 4);
  evidence.observations.push({ check: 'bulk reservation race', baselineStatuses: statuses, baselineChildClaims: children.length, fixedStatuses: [200, 409], fixedChildClaims: 2 });
});
