import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {NextRequest} from 'next/server.js';

// No credentials or production services: only synthetic read-only documents.
const out = path.resolve('test-results/leaderboard-route');
fs.mkdirSync(out, {recursive: true});
const fixture = {fail: false, project: {topMatmidim: []}, portions: []};
globalThis.__leaderboardRoute = {
  collection(name) {
    assert.ok(['lzecher_projects', 'lzecher_portions'].includes(name));
    const get = async () => {
      if (fixture.fail) throw new Error('Synthetic database outage');
      return name === 'lzecher_projects'
        ? {exists: fixture.project !== null, data: () => fixture.project}
        : {docs: fixture.portions.map(portion => ({data: () => portion}))};
    };
    return {doc: () => ({get}), where: () => ({get})};
  },
};
await build({entryPoints: ['src/app/api/projects/[id]/leaderboard/route.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: path.join(out, 'route.cjs'), plugins: [{name: 'synthetic-db', setup(builder) {
  builder.onResolve({filter: /\/firebase\/admin$/}, () => ({path: 'admin', namespace: 'fixture'}));
  builder.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({contents: 'export const getAdminDb = () => globalThis.__leaderboardRoute;'}));
}}]});
const {GET} = createRequire(import.meta.url)(path.join(out, 'route.cjs'));
const get = (all = false) => GET(new NextRequest(`http://localhost/api/projects/test/leaderboard${all ? '?all=1' : ''}`), {params: Promise.resolve({id: 'test'})});
let response = await get();
assert.equal(response.status, 200);
assert.deepEqual((await response.json()).matmidim, []);
fixture.project.topMatmidim = Array.from({length: 7}, (_, i) => ({name: `Learner ${i}`, count: 7 - i}));
response = await get();
assert.deepEqual((await response.json()).matmidim, fixture.project.topMatmidim.slice(0, 5));
fixture.portions = fixture.project.topMatmidim.flatMap(row => Array.from({length: row.count}, () => ({status: 'claimed', claimedByName: row.name})));
response = await get(true);
assert.deepEqual((await response.json()).matmidim, fixture.project.topMatmidim);
fixture.fail = true;
const log = console.error;
try {
  console.error = () => {};
  response = await get();
} finally { console.error = log; }
assert.equal(response.status, 503);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal('matmidim' in await response.json(), false, 'outage must not masquerade as an empty ranking');
fixture.fail = false;
assert.equal((await get()).status, 200, 'database recovery succeeds');
fixture.project = null;
assert.equal((await get()).status, 404);
console.log('Leaderboard route: empty, top five, show all, uncached 503, recovery, and missing project passed.');
