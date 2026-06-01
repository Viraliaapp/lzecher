import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["en", "he", "es", "fr"];
const sourceRoots = ["src/app", "src/components", "src/lib", "scripts"];
const localizedRoutes = [
  "about",
  "admin",
  "contact",
  "create",
  "dashboard",
  "edit",
  "halachic-guidance",
  "login",
  "memorial",
  "memorials",
  "privacy",
  "settings",
  "terms",
];
const allowedEmptyMessageKeys = new Set(["leaderboard.subtitle"]);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(message, details = []) {
  const body = details.length ? `\n${details.map((d) => `  - ${d}`).join("\n")}` : "";
  throw new Error(`${message}${body}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(path.join(root, dir))) return out;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if ([".next", "node_modules", "screenshots", "v8-screenshots"].includes(entry.name)) continue;
      walk(rel, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

function lineFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const messagesByLocale = Object.fromEntries(
  locales.map((locale) => [
    locale,
    flatten(JSON.parse(read(`messages/${locale}.json`))),
  ])
);
const allMessageKeys = [...new Set(locales.flatMap((locale) => Object.keys(messagesByLocale[locale])))].sort();

const messageProblems = [];
for (const locale of locales) {
  const messages = messagesByLocale[locale];
  for (const key of allMessageKeys) {
    if (!(key in messages)) messageProblems.push(`messages/${locale}.json missing ${key}`);
  }
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== "string") continue;
    if (value.includes("\uFFFD")) messageProblems.push(`messages/${locale}.json ${key} contains replacement characters`);
    if (!allowedEmptyMessageKeys.has(key) && value.trim() === "") {
      messageProblems.push(`messages/${locale}.json ${key} is empty`);
    }
  }
}
if (messageProblems.length) fail("Message catalog audit failed.", messageProblems.slice(0, 80));

const sourceFiles = sourceRoots.flatMap((dir) => walk(dir));
const allLocaleKeys = new Set(allMessageKeys);
const missingTranslationCalls = [];

for (const rel of sourceFiles.filter((file) => file.startsWith("src/"))) {
  const text = read(rel);
  const translatorDefs = [];

  for (const match of text.matchAll(/\bconst\s+(\w+)\s*=\s*useTranslations\(\s*["']([^"']+)["']\s*\)/g)) {
    translatorDefs.push({ name: match[1], namespace: match[2], index: match.index ?? 0 });
  }
  for (const match of text.matchAll(/\bconst\s+(\w+)\s*=\s*await\s+getTranslations\(\s*["']([^"']+)["']\s*\)/g)) {
    translatorDefs.push({ name: match[1], namespace: match[2], index: match.index ?? 0 });
  }
  for (const match of text.matchAll(/\bconst\s+(\w+)\s*=\s*await\s+getTranslations\(\s*\{[\s\S]*?namespace:\s*["']([^"']+)["'][\s\S]*?\}\s*\)/g)) {
    translatorDefs.push({ name: match[1], namespace: match[2], index: match.index ?? 0 });
  }
  translatorDefs.sort((a, b) => a.index - b.index);

  for (const fn of [...new Set(translatorDefs.map((def) => def.name))]) {
    const callPattern = new RegExp(`\\b${fn}\\(\\s*["']([^"']+)["']\\s*[,)]`, "g");
    for (const match of text.matchAll(callPattern)) {
      const matchIndex = match.index ?? 0;
      const def = translatorDefs
        .filter((candidate) => candidate.name === fn && candidate.index < matchIndex)
        .at(-1);
      if (!def) continue;
      const namespace = def.namespace;
      const key = `${namespace}.${match[1]}`;
      if (!allLocaleKeys.has(key)) {
        missingTranslationCalls.push(`${rel}:${lineFor(text, match.index ?? 0)} -> ${fn}("${match[1]}") expects ${key}`);
      }
    }
  }
}
if (missingTranslationCalls.length) {
  fail("Literal translation-key audit failed.", missingTranslationCalls.slice(0, 120));
}

const requiredDynamicKeys = [
  "landing.feature_multiTrack_title",
  "landing.feature_multiTrack_desc",
  "landing.feature_multiLanguage_title",
  "landing.feature_multiLanguage_desc",
  "landing.feature_communal_title",
  "landing.feature_communal_desc",
  "landing.feature_notifications_title",
  "landing.feature_notifications_desc",
  "landing.feature_shareLinks_title",
  "landing.feature_shareLinks_desc",
  "landing.feature_moderated_title",
  "landing.feature_moderated_desc",
  "landing.track_mishnayos_title",
  "landing.track_mishnayos_desc",
  "landing.track_mishnayos_count",
  "landing.track_tehillim_title",
  "landing.track_tehillim_desc",
  "landing.track_tehillim_count",
  "landing.track_shnayimMikra_title",
  "landing.track_shnayimMikra_desc",
  "landing.track_shnayimMikra_count",
  "landing.track_kabalos_title",
  "landing.track_kabalos_desc",
  "landing.track_kabalos_count",
  "landing.step_create_title",
  "landing.step_create_desc",
  "landing.step_share_title",
  "landing.step_share_desc",
  "landing.step_claim_title",
  "landing.step_claim_desc",
  "landing.step_learn_title",
  "landing.step_learn_desc",
];
const missingDynamicKeys = [];
for (const locale of locales) {
  for (const key of requiredDynamicKeys) {
    if (!(key in messagesByLocale[locale])) missingDynamicKeys.push(`messages/${locale}.json missing ${key}`);
  }
}
if (missingDynamicKeys.length) fail("Dynamic translation-key audit failed.", missingDynamicKeys);

const plainAnchorProblems = [];
const routeAlternation = localizedRoutes.join("|");
const plainAnchorRoutePattern = new RegExp(
  `<a\\b[^>\\n]*href\\s*=\\s*(?:"/(?:${routeAlternation})(?:[/"?#]|\\b)|'/(?:${routeAlternation})(?:[/'?#]|\\b)|\\{\\s*\`/(?:${routeAlternation})(?:[/\`?#]|\\b))`,
  "g"
);
for (const rel of sourceFiles.filter((file) => file.endsWith(".tsx"))) {
  const text = read(rel);
  for (const match of text.matchAll(plainAnchorRoutePattern)) {
    plainAnchorProblems.push(`${rel}:${lineFor(text, match.index ?? 0)} -> use @/i18n/navigation Link or include the locale explicitly`);
  }
}
if (plainAnchorProblems.length) {
  fail("Localized route anchor audit failed.", plainAnchorProblems);
}

const collectionProblems = [];
const collectionPattern = /\.collection\(\s*["']([^"']+)["']\s*\)/g;
for (const rel of sourceFiles) {
  const text = read(rel);
  for (const match of text.matchAll(collectionPattern)) {
    if (!match[1].startsWith("lzecher_")) {
      collectionProblems.push(`${rel}:${lineFor(text, match.index ?? 0)} -> ${match[1]}`);
    }
  }
}
if (collectionProblems.length) {
  fail("Firestore scope audit failed. Every collection must start with lzecher_.", collectionProblems);
}

const storageProblems = [];
const storageRefPattern = /ref\(\s*storage\s*,\s*([^)]+)\)/g;
for (const rel of sourceFiles.filter((file) => file.startsWith("src/"))) {
  const text = read(rel);
  for (const match of text.matchAll(storageRefPattern)) {
    if (!match[1].includes("lzecher/")) {
      storageProblems.push(`${rel}:${lineFor(text, match.index ?? 0)} -> ${match[0]}`);
    }
  }
}
if (storageProblems.length) {
  fail("Firebase Storage scope audit failed. Client storage refs must use the lzecher/ prefix.", storageProblems);
}

const clientLeakProblems = [];
for (const rel of sourceFiles.filter((file) => file.endsWith(".tsx") && file.startsWith("src/"))) {
  const text = read(rel);
  const isClientSurface = text.trimStart().startsWith('"use client"') || rel.startsWith("src/components/");
  if (!isClientSurface) continue;
  if (/\bpassword(Hash|Salt)\b/.test(text)) {
    clientLeakProblems.push(`${rel} references passwordHash/passwordSalt on a client-rendered surface`);
  }
  if (/firebase-admin|@\/lib\/firebase\/admin/.test(text)) {
    clientLeakProblems.push(`${rel} imports server Firebase admin code`);
  }
}
if (clientLeakProblems.length) {
  fail("Client secret/admin boundary audit failed.", clientLeakProblems);
}

const superAdminProblems = [];
for (const rel of sourceFiles.filter((file) => file.startsWith("src/app/api/admin/super/") && file.endsWith("route.ts"))) {
  const text = read(rel);
  if (!text.includes("requireSuperAdmin(idToken)")) {
    superAdminProblems.push(`${rel} does not call requireSuperAdmin(idToken)`);
  }
  if (!text.includes("lzecher_")) {
    superAdminProblems.push(`${rel} has no visible Lzecher collection scope`);
  }
}
if (superAdminProblems.length) fail("Super-admin API guard audit failed.", superAdminProblems);

const wordingFiles = [
  ...sourceFiles.filter((file) => file.startsWith("src/")),
  ...locales.map((locale) => `messages/${locale}.json`),
];
const sourceText = wordingFiles
  .map((file) => read(file))
  .join("\n");
for (const forbidden of ["ניהול תביעות", "המתמידים", "לומדים שלקחו על עצמם הכי הרבה חלקים"]) {
  if (sourceText.includes(forbidden)) fail(`Forbidden Hebrew wording still appears: ${forbidden}`);
}

console.log("Full-site static audit passed.");
