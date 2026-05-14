// Extract every t() call and cross-reference against locale files
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "src");
const MSGS = path.join(__dirname, "..", "..", "messages");

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
  return files;
}

// Find namespace from useTranslations('xx') or getTranslations('xx')
const NAMESPACE_RE = /(?:useTranslations|getTranslations)\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
// Find t('key') calls — capturing the literal key string
const T_CALL_RE = /\bt\(\s*["'`]([^"'`]+)["'`]/g;

const files = walk(SRC);
const usages = []; // { file, namespace?, key, line }

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  // collect namespaces in file (file-level — multiple useTranslations possible)
  const namespaces = [];
  let m;
  NAMESPACE_RE.lastIndex = 0;
  while ((m = NAMESPACE_RE.exec(src))) namespaces.push(m[1]);

  T_CALL_RE.lastIndex = 0;
  while ((m = T_CALL_RE.exec(src))) {
    const key = m[1];
    const before = src.slice(0, m.index);
    const line = before.split("\n").length;
    // If the key contains a dot, treat as a fully-qualified key (e.g. "softLogin.title")
    // Otherwise, prepend the file's namespace(s)
    if (key.includes(".")) {
      usages.push({ file: path.relative(SRC, f), key, line });
    } else if (namespaces.length === 0) {
      usages.push({ file: path.relative(SRC, f), key: `??.${key}`, line });
    } else {
      for (const ns of namespaces) usages.push({ file: path.relative(SRC, f), key: `${ns}.${key}`, line });
    }
  }
}

// Load locale files
const locales = ["en", "he", "es", "fr"];
const data = {};
for (const l of locales) {
  data[l] = JSON.parse(fs.readFileSync(path.join(MSGS, `${l}.json`), "utf8"));
}

function lookup(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

// Deduplicate keys
const uniqueKeys = [...new Set(usages.map((u) => u.key))].sort();

console.log(`Total t() usages: ${usages.length}`);
console.log(`Unique keys: ${uniqueKeys.length}`);

const missing = { en: [], he: [], es: [], fr: [] };
const empty = { en: [], he: [], es: [], fr: [] };
const placeholderMatching = { en: [], he: [], es: [], fr: [] }; // value === key path

for (const k of uniqueKeys) {
  if (k.startsWith("??.")) continue; // unknown namespace — can't check
  for (const l of locales) {
    const v = lookup(data[l], k);
    if (v === undefined) missing[l].push(k);
    else if (v.trim() === "") empty[l].push(k);
    else if (v === k) placeholderMatching[l].push(k);
  }
}

const out = {
  totalUsages: usages.length,
  uniqueKeys: uniqueKeys.length,
  unknownNamespace: uniqueKeys.filter((k) => k.startsWith("??.")),
  missing,
  empty,
  placeholderMatching,
};

console.log("Missing per locale:");
for (const l of locales) console.log(`  ${l}: ${missing[l].length}`);
console.log("Empty values per locale:");
for (const l of locales) console.log(`  ${l}: ${empty[l].length}`);
console.log("Placeholder (value === key) per locale:");
for (const l of locales) console.log(`  ${l}: ${placeholderMatching[l].length}`);
console.log("Unknown namespace usages:", out.unknownNamespace.length);

const outPath = path.join(__dirname, "..", "screenshots", "translation-audit.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("Full report:", outPath);
