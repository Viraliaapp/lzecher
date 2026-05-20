// V7 read-only user journeys A-F. NO writes or submits.
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const SS = path.join(__dirname, "..", "screenshots", "v7");
fs.mkdirSync(SS, { recursive: true });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── JOURNEY A: Anonymous homepage ──
    log("\n=== JOURNEY A: Anonymous homepage ===");
    const ctxA = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 900 } });
    const pA = await ctxA.newPage();
    await pA.goto("https://lzecher.com/he", { waitUntil: "domcontentloaded" });
    await pA.waitForTimeout(2500);
    await pA.screenshot({ path: path.join(SS, "journey-A-homepage-he.png"), fullPage: false });
    const memCards = await pA.$$('a[href*="/memorial/"]');
    const signIn = await pA.locator('a:has-text("כניסה"), a:has-text("התחבר")').first().count();
    const memorialsLink = await pA.locator('a:has-text("הנצחות")').first().count();
    const langSw = await pA.locator('button:has-text("עב"), button:has-text("EN")').first().count();
    log(`  memorial cards: ${memCards.length} ${memCards.length > 0 ? "✓" : "✗"}`);
    log(`  Sign-in CTA visible: ${signIn > 0 ? "✓" : "✗"}`);
    log(`  הנצחות link in header: ${memorialsLink > 0 ? "✓" : "✗"}`);
    log(`  language switcher: ${langSw > 0 ? "✓" : "✗"}`);
    await ctxA.close();

    // ── JOURNEY B: Click into a memorial ──
    log("\n=== JOURNEY B: Memorial page ===");
    const ctxB = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1000 } });
    const pB = await ctxB.newPage();
    await pB.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await pB.waitForTimeout(2500);
    await pB.screenshot({ path: path.join(SS, "journey-B-memorial-he.png"), fullPage: false });
    const h1 = await pB.locator("h1").first().textContent();
    const tabs = await pB.$$('[role="tab"]');
    const tabTexts = await Promise.all(tabs.map((t) => t.textContent()));
    const hasZL = /ז״ל|ע״ה|זצ״ל/.test(h1 || "");
    const has3Tabs = tabs.length >= 3 && tabTexts.some((t) => /משניות/.test(t || "")) && tabTexts.some((t) => /תהלים|תהילים/.test(t || "")) && tabTexts.some((t) => /קבלות/.test(t || ""));
    log(`  hero h1: "${h1?.trim().slice(0, 60)}" — has honorific: ${hasZL ? "✓" : "✗"}`);
    log(`  3 tabs (משניות+תהלים+קבלות): ${has3Tabs ? "✓" : "✗"} (got: ${tabTexts.join("|")})`);
    await ctxB.close();

    // ── JOURNEY C: Mishnayos drill — sedarim RTL order + Hebrew numerals ──
    log("\n=== JOURNEY C: Mishnayos sedarim + perek view ===");
    const ctxC = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1100 } });
    const pC = await ctxC.newPage();
    await pC.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await pC.waitForTimeout(2500);
    await pC.evaluate(() => window.scrollTo(0, 500));
    await pC.waitForTimeout(500);
    await pC.screenshot({ path: path.join(SS, "journey-C-sedarim.png"), fullPage: false });
    // Extract sedarim DOM order
    const allBtns = await pC.$$('button');
    const sederOrder = [];
    for (const b of allBtns) {
      const t = ((await b.textContent()) || "").trim();
      const m = t.match(/^(זרעים|מועד|נשים|נזיקין|קדשים|טהרות)/);
      if (m && !sederOrder.includes(m[1])) sederOrder.push(m[1]);
    }
    const canonical = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"];
    const okOrder = canonical.every((e, i) => sederOrder[i] === e);
    log(`  Sedarim DOM order: ${sederOrder.join(" → ")} ${okOrder ? "✓" : "✗"}`);

    // Click a seder + masechta to verify gematria
    const p4 = await pC.$$('button.p-4');
    if (p4[1]) await p4[1].click({ force: true });
    await pC.waitForTimeout(700);
    const mst = await pC.$$('div.bg-cream-warm button');
    if (mst[0]) await mst[0].click({ force: true });
    await pC.waitForTimeout(700);
    const cardTitles = await pC.$$eval('div.bg-cream-warm p.font-medium', (els) => els.slice(0, 5).map((e) => (e.textContent || "").trim()));
    log(`  perek titles (first 5): ${cardTitles.join(" | ")}`);
    const hasGematria = cardTitles.some((t) => /[א-ת]׳|[א-ת]״[א-ת]/.test(t));
    const hasArabic = cardTitles.some((t) => /\d/.test(t));
    log(`  Hebrew gematria: ${hasGematria ? "✓" : "✗"}, Arabic digits: ${hasArabic ? "✗ FOUND" : "✓ none"}`);
    await ctxC.close();

    // ── JOURNEY D: Open claim modal (do NOT submit) ──
    log("\n=== JOURNEY D: Claim modal (READ ONLY — no submit) ===");
    const ctxD = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1100 } });
    const pD = await ctxD.newPage();
    await pD.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await pD.waitForTimeout(2500);
    const p4D = await pD.$$('button.p-4');
    if (p4D[1]) await p4D[1].click({ force: true });
    await pD.waitForTimeout(600);
    const mstD = await pD.$$('div.bg-cream-warm button');
    // Find a masechta with available perakim
    let claimBtn = null;
    for (let i = 0; i < Math.min(mstD.length, 10); i++) {
      await mstD[i].click({ force: true }).catch(() => {});
      await pD.waitForTimeout(400);
      const candidates = await pD.$$('button:has-text("אני לוקח")');
      if (candidates.length > 0) { claimBtn = candidates[0]; break; }
      await mstD[i].click({ force: true }).catch(() => {});
      await pD.waitForTimeout(300);
    }
    if (claimBtn) {
      await claimBtn.click({ force: true });
      await pD.waitForTimeout(1200);
      await pD.screenshot({ path: path.join(SS, "journey-D-claim-modal.png"), fullPage: false });
      const dlg = (await pD.$$('[role="dialog"]'))[0];
      const inputs = dlg ? await dlg.$$('input') : [];
      const visibleEmail = await pD.locator('[role="dialog"] input[type="email"]:visible').count();
      const addEmailLink = await pD.locator('[role="dialog"] button:has-text("הוסף אימייל")').count();
      log(`  modal inputs: ${inputs.length}, email field visible: ${visibleEmail}, +Add email link: ${addEmailLink}`);
      log(`  default state name-only: ${inputs.length === 1 && visibleEmail === 0 && addEmailLink > 0 ? "✓ FIXED" : "✗"}`);
      // Click + Add email
      if (addEmailLink > 0) {
        await pD.locator('[role="dialog"] button:has-text("הוסף אימייל")').click({ force: true });
        await pD.waitForTimeout(500);
        await pD.screenshot({ path: path.join(SS, "journey-D-claim-modal-with-email.png"), fullPage: false });
        const visAfter = await pD.locator('[role="dialog"] input[type="email"]:visible').count();
        log(`  after +Add: email field now visible: ${visAfter > 0 ? "✓" : "✗"}`);
      }
      // DO NOT submit — close
      const cancelBtn = await pD.locator('[role="dialog"] button:has-text("ביטול")').first();
      if (await cancelBtn.count()) await cancelBtn.click({ force: true });
    } else {
      log("  ⚠ no available perek found to test claim modal");
    }
    await ctxD.close();

    // ── JOURNEY E: Already-claimed perek shows name ──
    log("\n=== JOURNEY E: Claimed perek shows 'נלקח על ידי [name]' ===");
    const ctxE = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1100 } });
    const pE = await ctxE.newPage();
    await pE.goto("https://lzecher.com/he/memorial/memorial-ubk0n0", { waitUntil: "domcontentloaded" });
    await pE.waitForTimeout(2500);
    // Drill into Moed → Shabbos to find claimed perakim
    const p4E = await pE.$$('button.p-4');
    for (let sIdx = 1; sIdx <= 6 && sIdx < p4E.length; sIdx++) {
      await p4E[sIdx].click({ force: true }).catch(() => {});
      await pE.waitForTimeout(500);
      const sBtn = await pE.locator('div.bg-cream-warm button:has-text("שבת")').first();
      if (await sBtn.count()) { await sBtn.click({ force: true }); await pE.waitForTimeout(700); break; }
      await p4E[sIdx].click({ force: true }).catch(() => {});
    }
    await pE.screenshot({ path: path.join(SS, "journey-E-claimed-perek.png"), fullPage: false });
    const eText = await pE.evaluate(() => document.body.innerText);
    const eMatches = eText.match(/נלקח על ידי [^\n]+/g) || [];
    log(`  '${eMatches.length}' instances of 'נלקח על ידי ...' found`);
    const eEmpty = eMatches.filter((m) => /^נלקח על ידי\s*$/.test(m.trim())).length;
    log(`  empty names (BUG 2 evidence): ${eEmpty} — BUG 2 ${eEmpty === 0 ? "FIXED ✓" : "STILL PRESENT ✗"}`);
    await ctxE.close();

    // ── JOURNEY F: Mobile responsive ──
    log("\n=== JOURNEY F: Mobile (iPhone 13) ===");
    const ctxF = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
    const pF = await ctxF.newPage();
    await pF.goto("https://lzecher.com/he", { waitUntil: "domcontentloaded" });
    await pF.waitForTimeout(2000);
    await pF.screenshot({ path: path.join(SS, "journey-F-mobile-home.png"), fullPage: false });
    await pF.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await pF.waitForTimeout(2500);
    await pF.screenshot({ path: path.join(SS, "journey-F-mobile-memorial.png"), fullPage: false });
    log(`  mobile screenshots captured (375x812 iPhone 13)`);
    await ctxF.close();

    log("\n=== DONE ===");
  } catch (err) {
    log("EXCEPTION: " + err.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SS, "v7-journeys-report.txt"), REPORT.join("\n"));
})();
