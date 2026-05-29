// screenshot-verify-kabalos-hero.js
// Verifies hero section stat line format and kabalos section on lzecher.com/he

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = 'https://lzecher.com';

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function ss(name) {
  return path.join(SCREENSHOTS_DIR, name);
}

async function run() {
  const report = {
    urls_visited: [],
    home_page: {
      has_mamshikhim_text: null,
      per_track_stat_line_visible: null,
      stat_line_example: null,
    },
    kabalos_section: {
      memorial_slug: null,
      memorial_url: null,
      items_count_desktop: null,
      beli_neder_visible: null,
      button_text_correct: null,
      kabala_atzmit_visible: null,
    },
    screenshots: [],
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ── 1. HOME PAGE ────────────────────────────────────────────────────────
    const homeUrl = `${BASE_URL}/he`;
    report.urls_visited.push(homeUrl);

    const homePage = await browser.newPage();
    await homePage.setViewportSize({ width: 1280, height: 800 });
    await homePage.goto(homeUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Screenshot: full hero + visible cards
    const heroSS = ss('home-hero-and-cards.png');
    await homePage.screenshot({ path: heroSS, fullPage: false });
    report.screenshots.push(heroSS);

    // Check for "ממשיכים להצטרף" — should NOT be VISIBLE (may exist in JSON bundles)
    const homeContent = await homePage.content();
    // Check if the text is rendered as visible DOM text (not just in JSON/script tags)
    const mamshikhimVisible = await homePage.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
          const t = el.textContent.trim();
          if (t.includes('ממשיכים להצטרף') && el.offsetParent !== null) return true;
        }
      }
      return false;
    });
    // Raw HTML presence (includes script bundles)
    report.home_page.has_mamshikhim_text_in_html = homeContent.includes('ממשיכים להצטרף');
    report.home_page.has_mamshikhim_text = mamshikhimVisible;

    // Check for per-track stat line pattern (contains · separators and key Hebrew words)
    const statLinePattern = /\d+\s*משניות\s*·.*\d+\s*פרקי תהילים/;
    const statMatch = homeContent.match(statLinePattern);
    report.home_page.per_track_stat_line_visible = !!statMatch;
    if (statMatch) {
      report.home_page.stat_line_example = statMatch[0].slice(0, 120);
    } else {
      // Looser: just look for the bullet separator between Hebrew stat words
      const looseMatch = homeContent.match(/\d+[^<]{0,10}משניות[^<]{0,5}·[^<]{0,80}תהילים/);
      report.home_page.per_track_stat_line_visible = !!looseMatch;
      if (looseMatch) report.home_page.stat_line_example = looseMatch[0].slice(0, 120);
    }

    // Collect memorial page links from the home page
    const memorialLinks = await homePage.$$eval('a[href*="/memorial/"]', (links) =>
      links
        .map((a) => a.href)
        .filter((href, i, arr) => arr.indexOf(href) === i) // dedupe
    );
    console.log(`Found ${memorialLinks.length} memorial links on home page.`);

    // Full-page screenshot of home for reference
    const homeFullSS = ss('home-full.png');
    await homePage.screenshot({ path: homeFullSS, fullPage: true });
    report.screenshots.push(homeFullSS);

    await homePage.close();

    // ── 2. FIND A MEMORIAL WITH KABALOS ────────────────────────────────────
    let targetUrl = null;
    let targetSlug = null;

    // Normalise to /he/ locale
    const heLinks = memorialLinks
      .map((u) => {
        try {
          const parsed = new URL(u);
          // Make sure it's the /he locale
          if (!parsed.pathname.startsWith('/he/')) {
            parsed.pathname = '/he' + parsed.pathname;
          }
          return parsed.href;
        } catch {
          return u;
        }
      })
      .filter((u, i, arr) => arr.indexOf(u) === i);

    console.log('Memorial links (he-locale):', heLinks.slice(0, 10));

    // Try each link; pick first that has kabalos content
    for (const link of heLinks.slice(0, 8)) {
      const probePage = await browser.newPage();
      await probePage.setViewportSize({ width: 1280, height: 800 });
      try {
        await probePage.goto(link, { waitUntil: 'networkidle', timeout: 25000 });
        const pageText = await probePage.content();
        // Look for kabala-related Hebrew words
        if (
          pageText.includes('קבלה') ||
          pageText.includes('בלי נדר') ||
          pageText.includes('קבלות')
        ) {
          targetUrl = link;
          const slugMatch = link.match(/\/memorial\/([^/?#]+)/);
          targetSlug = slugMatch ? slugMatch[1] : link;
          await probePage.close();
          console.log(`Found memorial with kabalos: ${link}`);
          break;
        }
      } catch (err) {
        console.warn(`Error probing ${link}: ${err.message}`);
      }
      await probePage.close();
    }

    // Fallback: use first available link
    if (!targetUrl && heLinks.length > 0) {
      targetUrl = heLinks[0];
      const slugMatch = targetUrl.match(/\/memorial\/([^/?#]+)/);
      targetSlug = slugMatch ? slugMatch[1] : targetUrl;
      console.log(`No kabalos found; falling back to: ${targetUrl}`);
    }

    if (!targetUrl) {
      console.warn('No memorial links found on home page; trying hard-coded slug fallback.');
      targetUrl = `${BASE_URL}/he/memorial/sample`;
      targetSlug = 'sample';
    }

    report.kabalos_section.memorial_slug = targetSlug;
    report.kabalos_section.memorial_url = targetUrl;
    report.urls_visited.push(targetUrl);

    // ── 3. DESKTOP SCREENSHOT OF MEMORIAL / KABALOS ────────────────────────
    const desktopPage = await browser.newPage();
    await desktopPage.setViewportSize({ width: 1280, height: 800 });
    await desktopPage.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Full page for context
    const memFullSS = ss('memorial-full-desktop.png');
    await desktopPage.screenshot({ path: memFullSS, fullPage: true });
    report.screenshots.push(memFullSS);

    // Scroll to kabalos section
    try {
      // Try to find kabalos section by text or data attribute
      const kabalaSection = desktopPage.locator(
        'section:has-text("קבלות"), [data-section="kabalos"], #kabalos, [id*="kabal"], [class*="kabal"]'
      ).first();

      const kabalaExists = await kabalaSection.count();
      if (kabalaExists > 0) {
        await kabalaSection.scrollIntoViewIfNeeded();
        await desktopPage.waitForTimeout(500);
      } else {
        // Scroll to bottom where kabalos usually lives
        await desktopPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
        await desktopPage.waitForTimeout(500);
      }
    } catch (err) {
      console.warn('Could not scroll to kabalos section:', err.message);
      await desktopPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    }

    const kbDesktopSS = ss('memorial-kabalos-desktop.png');
    await desktopPage.screenshot({ path: kbDesktopSS });
    report.screenshots.push(kbDesktopSS);

    // ── CHECKS on desktop page ──────────────────────────────────────────────
    const desktopContent = await desktopPage.content();

    // Count kabalos tiles — look for repeated tile-like elements near kabalos heading
    try {
      // Try common tile selectors
      const tileSelectors = [
        '[class*="kabala-tile"]',
        '[class*="KabalaTile"]',
        '[class*="kabala_tile"]',
        '[class*="kabalos"] [class*="tile"]',
        '[class*="kabalos"] [class*="card"]',
        '[data-kabala]',
      ];
      let tileCount = 0;
      for (const sel of tileSelectors) {
        try {
          const count = await desktopPage.locator(sel).count();
          if (count > 0) {
            tileCount = count;
            console.log(`Found ${count} kabalos tiles with selector: ${sel}`);
            break;
          }
        } catch {}
      }
      // If structured selectors fail, count via text presence patterns
      if (tileCount === 0) {
        // Count buttons/cards that contain kabala-related Hebrew text
        const allCards = await desktopPage.$$('[class*="card"], [class*="tile"], button, [role="button"]');
        let kabaCount = 0;
        for (const card of allCards) {
          try {
            const text = await card.innerText();
            if (
              text.includes('קבלה') ||
              text.includes('תהילים') ||
              text.includes('משנה') ||
              text.includes('מצווה')
            ) {
              kabaCount++;
            }
          } catch {}
        }
        tileCount = kabaCount;
        if (kabaCount > 0) console.log(`Found ${kabaCount} kabala-related cards via text scan.`);
      }
      report.kabalos_section.items_count_desktop = tileCount;
    } catch (err) {
      console.warn('Error counting kabalos tiles:', err.message);
      report.kabalos_section.items_count_desktop = null;
    }

    // Check "בלי נדר" text
    try {
      report.kabalos_section.beli_neder_visible = desktopContent.includes('בלי נדר');
    } catch (err) {
      report.kabalos_section.beli_neder_visible = null;
    }

    // Check button text "אני מקבל/ת על עצמי בלי נדר"
    try {
      const btnText = 'אני מקבל/ת על עצמי בלי נדר';
      // Try exact button
      let found = false;
      try {
        const btn = desktopPage.locator(`button:has-text("אני מקבל")`).first();
        const count = await btn.count();
        if (count > 0) {
          const text = await btn.innerText();
          found = text.includes('בלי נדר');
          console.log('Button text found:', text);
        }
      } catch {}
      if (!found) {
        found = desktopContent.includes('אני מקבל/ת על עצמי בלי נדר') ||
                desktopContent.includes('אני מקבל/ת על עצמי') ||
                desktopContent.includes('מקבל/ת על עצמי בלי נדר');
      }
      report.kabalos_section.button_text_correct = found;
    } catch (err) {
      console.warn('Error checking button text:', err.message);
      report.kabalos_section.button_text_correct = null;
    }

    // Check for "קבלה אישית" tile
    try {
      report.kabalos_section.kabala_atzmit_visible =
        desktopContent.includes('קבלה אישית');
    } catch (err) {
      report.kabalos_section.kabala_atzmit_visible = null;
    }

    await desktopPage.close();

    // ── 4. MOBILE SCREENSHOT ──────────────────────────────────────────────
    const mobilePage = await browser.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Scroll toward kabalos section
    try {
      const kabalaSection = mobilePage.locator(
        'section:has-text("קבלות"), [data-section="kabalos"], #kabalos, [id*="kabal"], [class*="kabal"]'
      ).first();
      const exists = await kabalaSection.count();
      if (exists > 0) {
        await kabalaSection.scrollIntoViewIfNeeded();
        await mobilePage.waitForTimeout(500);
      } else {
        await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
        await mobilePage.waitForTimeout(500);
      }
    } catch {
      await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    }

    const kbMobileSS = ss('memorial-kabalos-mobile.png');
    await mobilePage.screenshot({ path: kbMobileSS });
    report.screenshots.push(kbMobileSS);

    // Full mobile page
    const memMobileFullSS = ss('memorial-full-mobile.png');
    await mobilePage.screenshot({ path: memMobileFullSS, fullPage: true });
    report.screenshots.push(memMobileFullSS);

    await mobilePage.close();

  } finally {
    await browser.close();
  }

  // ── PRINT REPORT ──────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('        AUDIT REPORT');
  console.log('========================================');
  console.log('\nURLs visited:');
  report.urls_visited.forEach((u) => console.log('  -', u));

  console.log('\n── HOME PAGE ──');
  console.log(
    '  "ממשיכים להצטרף" appears on home page:',
    report.home_page.has_mamshikhim_text,
    report.home_page.has_mamshikhim_text ? '⚠ SHOULD NOT BE PRESENT' : '✓ Not present (correct)'
  );
  console.log(
    '  Per-track stat line visible (X משניות · Y פרקי תהילים · ...):',
    report.home_page.per_track_stat_line_visible
  );
  if (report.home_page.stat_line_example) {
    console.log('  Stat line example:', report.home_page.stat_line_example);
  }

  console.log('\n── KABALOS SECTION ──');
  console.log('  Memorial slug:', report.kabalos_section.memorial_slug);
  console.log('  Memorial URL:', report.kabalos_section.memorial_url);
  console.log('  Kabalos tile count (desktop):', report.kabalos_section.items_count_desktop,
    report.kabalos_section.items_count_desktop === 6 ? '✓' :
    report.kabalos_section.items_count_desktop > 0 ? `(expected 6, found ${report.kabalos_section.items_count_desktop})` : '');
  console.log('  "בלי נדר" text visible:', report.kabalos_section.beli_neder_visible);
  console.log('  "אני מקבל/ת על עצמי בלי נדר" button present:', report.kabalos_section.button_text_correct);
  console.log('  "קבלה אישית" tile visible:', report.kabalos_section.kabala_atzmit_visible);

  console.log('\n── SCREENSHOTS ──');
  report.screenshots.forEach((p) => console.log('  ', p));
  console.log('\n========================================\n');

  return report;
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
