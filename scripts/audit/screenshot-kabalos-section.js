// Focused screenshot of the kabalos section on the memorial page
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://lzecher.com/he/memorial/memorial-0xowxi', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Find the "קחו חלק בלימוד" section (learn section with track cards + kabalos)
  const learnSection = page.locator('text=קחו חלק בלימוד').first();
  const learnCount = await learnSection.count();
  console.log('Learn section found:', learnCount > 0);

  if (learnCount > 0) {
    await learnSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'memorial-learn-section-desktop.png') });
    console.log('Saved: memorial-learn-section-desktop.png');
  }

  // Try to screenshot the 3-track cards area (mishna, kabalos, tehilim)
  const trackCards = page.locator('[style*="background: rgb(250, 246, 236)"], [style*="background:rgb(250"]').first();
  const tc = await trackCards.count();
  console.log('Track cards area found:', tc > 0);

  // Scroll to kabalos specifically
  const kabalosTile = page.locator('text=קבלות').first();
  const kt = await kabalosTile.count();
  console.log('Kabalos tile found:', kt > 0);
  if (kt > 0) {
    await kabalosTile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'memorial-kabalos-tile-focused.png') });
    console.log('Saved: memorial-kabalos-tile-focused.png');
  }

  // Get bounding box of the full learn section and screenshot it specifically
  try {
    const sectionEl = await page.$('text=קחו חלק בלימוד');
    if (sectionEl) {
      // Find the parent section
      const parent = await sectionEl.evaluateHandle(el => {
        let node = el;
        for (let i = 0; i < 5; i++) {
          node = node.parentElement;
          if (node && (node.tagName === 'SECTION' || node.tagName === 'DIV' && node.offsetHeight > 400)) {
            return node;
          }
        }
        return node;
      });
      const box = await parent.asElement()?.boundingBox();
      if (box) {
        console.log('Learn section bounding box:', box);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'memorial-learn-section-clip.png'),
          clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 900) },
        });
        console.log('Saved: memorial-learn-section-clip.png');
      }
    }
  } catch (err) {
    console.warn('Clip screenshot error:', err.message);
  }

  // Check for "בלי נדר" in kabalos tiles via DOM
  const allKabalaText = await page.evaluate(() => {
    // Find the kabalos heading
    const allEls = Array.from(document.querySelectorAll('*'));
    const kabHead = allEls.find(el => el.textContent.trim() === 'קבלות' && el.tagName.match(/^[HPB]/));
    if (!kabHead) return { found: false, tiles: [] };
    // Walk up to the card container
    let container = kabHead.parentElement;
    for (let i = 0; i < 6; i++) {
      container = container.parentElement;
      if (!container) break;
    }
    // Get tile-like children
    const tiles = container ? Array.from(container.querySelectorAll('button, [role="button"], [class*="tile"], [class*="card"]'))
      .map(el => el.innerText.trim()).filter(t => t.length > 0) : [];
    return { found: true, tiles };
  });
  console.log('Kabalos area tiles:', JSON.stringify(kabalaText, null, 2));

  await browser.close();
})().catch(console.error);
