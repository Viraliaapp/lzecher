// Runs only a temporary, unauthenticated demo project on loopback emulators.
// Never use this config for deployment or import real project data.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const toolsDir = process.env.LZECHER_EMULATOR_TOOLS;
assert.ok(toolsDir && path.isAbsolute(toolsDir), 'Set LZECHER_EMULATOR_TOOLS to the isolated CLI/rules-test installation');
const cli = path.join(toolsDir, 'node_modules/firebase-tools/lib/bin/firebase.js');
assert.ok(fs.existsSync(cli), 'Install firebase-tools in LZECHER_EMULATOR_TOOLS');
const output = path.join(root, 'test-results/emulator');
fs.mkdirSync(output, { recursive: true });
const ports = { firestore: 8089, auth: 9099, hub: 4409, logging: 4509 };
const websocketPort = 9159;
for (const port of [...Object.values(ports), websocketPort]) {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}
const rules = path.join(output, 'firestore.rules');
fs.copyFileSync(path.join(root, 'firebase/lzecher-firestore.rules'), rules);
const config = path.join(output, 'firebase.json');
fs.writeFileSync(config, JSON.stringify({
  firestore: { rules: 'firestore.rules' },
  emulators: { ...Object.fromEntries(Object.entries(ports).map(([key, port]) => [key, { host: '127.0.0.1', port, ...(key === 'firestore' ? { websocketPort } : {}) }])), ui: { enabled: false }, singleProjectMode: true },
}, null, 2));
const project = 'demo-lzecher-audit';
const env = { ...process.env, CI: 'true', FIREBASE_CLI_DISABLE_USAGE: '1', FIREBASE_TOKEN: '',
  XDG_CONFIG_HOME: path.join(toolsDir, 'config'), CLOUDSDK_CONFIG: path.join(toolsDir, 'gcloud-config'),
  FIREBASE_EMULATORS_PATH: path.join(toolsDir, 'emulators'), GOOGLE_APPLICATION_CREDENTIALS: '',
  FIREBASE_ADMIN_CLIENT_EMAIL: '', FIREBASE_ADMIN_PRIVATE_KEY: '', FIREBASE_SERVICE_ACCOUNT: '',
  FIREBASE_ADMIN_PROJECT_ID: project, FIREBASE_PROJECT_ID: project, GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, FIREBASE_STORAGE_BUCKET: `${project}.appspot.com`,
  FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`, FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
  RESEND_API_KEY: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
  REMINDER_ACTION_SECRET: 'synthetic-emulator-test-secret',
};
const command = `"${process.execPath}" "${path.join(root, 'node_modules/tsx/dist/cli.mjs')}" --test "${path.join(root, 'scripts/audit/firebase-emulator.integration.test.mjs')}"`;
const child = spawn(process.execPath, [cli, 'emulators:exec', '--only', 'firestore,auth', '--project', project, '--config', config, '--non-interactive', command], { cwd: output, env, windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
const code = await new Promise(resolve => child.once('exit', resolve));
process.exitCode = typeof code === 'number' ? code : 1;
