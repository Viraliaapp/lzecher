/** PROMPT C production audit — read-only browser checks + screenshots. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "https://lzecher.com";
const OUT = "scripts/audit/prompt-c";
mkdirSync(OUT, { recursive: true });

const TARGET_SLUG = "memorial-0xowxi"; // יחזקאל דוד נחשון — has data + leaderboard

const STATUS_URLS = [
  "/en", "/he", "/es", "/fr",
  "/en/create", "/en/dashboard", "/en/about", "/en/halachic-guidance",
  `/en/memorial/${TARGET_SLUG}`, `/he/memorial/${TARGET_SLUG}`,
  "/sitemap.xml", "/robots.txt",
];

function pct(text) {
  const m = text && text.match(/(\d+)\s*%/);
  return m ? parseInt(m[1], 10) : null;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
const page = await ctx.newPage();
const results = {};

// ── Section 9: status codes ──
console.log("=== STATUS CODES ===");
const status = {};
for (const u of STATUS_URLS) {
  try {
    const resp = await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 30000 });
    status[u] = resp ? resp.status() : "no-response";
  } catch (e) {
    status[u] = "ERR:" + e.message.slice(0, 40);
  }
  console.log(`  ${status[u]}  ${u}`);
}
results.status = status;

// ── Home (he): global counter + cards + screenshot ──
console.log("\n=== HOME (he) ===");
await page.goto(`${BASE}/he`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500); // let counter/bubbles poll
const homeText = await page.locator("body").innerText();
results.globalCounterOnHome = /כלל ישראל לומד יחד/.test(homeText);
results.counterNumbersVisible = /585|441/.test(homeText.replace(/[, ]/g, ""));
// card % for target slug
let cardPct = null;
try {
  const card = page.locator(`a[href*="${TARGET_SLUG}"]`).first();
  const cardText = await card.innerText({ timeout: 5000 });
  cardPct = pct(cardText);
} catch { /* */ }
results.cardPct = cardPct;
await page.screenshot({ path: `${OUT}/home-he.png`, fullPage: true });
console.log(`  globalCounter heading present: ${results.globalCounterOnHome}`);
console.log(`  counter numbers visible: ${results.counterNumbersVisible}`);
console.log(`  card % for ${TARGET_SLUG}: ${cardPct}`);

// ── Home (en) screenshot for locale check ──
await page.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/home-en.png`, fullPage: false });

// ── Memorial (he): hero %, dual bars, kabalos, leaderboard ──
console.log(`\n=== MEMORIAL ${TARGET_SLUG} (he) ===`);
await page.goto(`${BASE}/he/memorial/${TARGET_SLUG}`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000); // leaderboard polls
const memText = await page.locator("body").innerText();
// hero pct = first big % — grab from the taken stat area
let heroPct = null;
try {
  const heroEl = page.locator("text=/^\\d+%$/").first();
  heroPct = pct(await heroEl.innerText({ timeout: 5000 }));
} catch { heroPct = pct(memText); }
results.heroPct = heroPct;
results.dualBars_taken = /נלקחו/.test(memText);
results.dualBars_completed = /הושלמו/.test(memText);
results.leaderboard_present = /יישר כוח/.test(memText);
results.leaderboard_hasName = /יהודה שלנג/.test(memText);
results.kabalos_bliNeder = /בלי נדר/.test(memText);
await page.screenshot({ path: `${OUT}/memorial-he.png`, fullPage: true });
console.log(`  hero %: ${heroPct}  (card %: ${cardPct})  PARITY: ${heroPct === cardPct ? "MATCH ✅" : "MISMATCH ❌"}`);
console.log(`  dual bars: taken=${results.dualBars_taken} completed=${results.dualBars_completed}`);
console.log(`  leaderboard present=${results.leaderboard_present} hasName=${results.leaderboard_hasName}`);
console.log(`  kabalos 'בלי נדר' note: ${results.kabalos_bliNeder}`);

// scroll to kabalos section + screenshot if present
try {
  const kabBtn = page.locator("text=קבלות").first();
  if (await kabBtn.count()) { await kabBtn.click({ timeout: 4000 }); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/memorial-kabalos.png`, fullPage: true }); }
} catch { /* */ }

console.log("\n=== RESULT JSON ===");
console.log(JSON.stringify(results, null, 2));
await browser.close();
