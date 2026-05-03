#!/usr/bin/env node
"use strict";

/**
 * check-encoding.js
 * Scans source files for U+FFFD (Unicode replacement character) occurrences.
 * Covers: src/**\/*.ts, src/**\/*.tsx, messages/**\/*.json, scripts/**\/*.ts
 * Exits with code 1 if any are found, 0 if clean.
 */

const fs = require("fs");
const path = require("path");

const REPLACEMENT_CHAR = "\uFFFD";

// Resolve project root (one level up from scripts/)
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Recursively collect files matching a set of extensions under a directory.
 * @param {string} dir - Absolute path to search
 * @param {string[]} extensions - e.g. ['.ts', '.tsx']
 * @param {string[]} result - accumulator
 */
function collectFiles(dir, extensions, result) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      collectFiles(fullPath, extensions, result);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        result.push(fullPath);
      }
    }
  }
}

// Define scan targets: [directory (relative to project root), extensions[]]
const SCAN_TARGETS = [
  { dir: "src",      exts: [".ts", ".tsx"] },
  { dir: "messages", exts: [".json"] },
  { dir: "scripts",  exts: [".ts"] },
];

const allFiles = [];
for (const target of SCAN_TARGETS) {
  const absDir = path.join(PROJECT_ROOT, target.dir);
  if (fs.existsSync(absDir)) {
    collectFiles(absDir, target.exts, allFiles);
  }
}

let totalIssues = 0;
const affectedFiles = [];

for (const absFile of allFiles) {
  let content;
  try {
    content = fs.readFileSync(absFile, "utf8");
  } catch (err) {
    console.error(`[ERROR] Could not read ${absFile}: ${err.message}`);
    continue;
  }

  if (!content.includes(REPLACEMENT_CHAR)) continue;

  const relFile = path.relative(PROJECT_ROOT, absFile);
  const lines = content.split("\n");
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(REPLACEMENT_CHAR)) {
      hits.push({ lineNumber: i + 1, line: lines[i] });
    }
  }

  if (hits.length > 0) {
    affectedFiles.push(relFile);
    console.log(`\nFOUND in: ${relFile}`);
    for (const hit of hits) {
      totalIssues++;
      console.log(`  Line ${hit.lineNumber}: ${hit.line}`);
    }
  }
}

if (totalIssues === 0) {
  console.log("✓ No U+FFFD replacement characters found. All files are clean.");
  process.exit(0);
} else {
  console.log(
    `\n✗ Found ${totalIssues} occurrence(s) of U+FFFD in ${affectedFiles.length} file(s).`
  );
  process.exit(1);
}
