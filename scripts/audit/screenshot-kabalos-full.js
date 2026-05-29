// Full screenshot of kabalos tiles after clicking into the kabalos track
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  async function captureKabalos(viewport, suffix) {
    const page = await browser.newPage();
    await page.setViewportSize(viewport);
    await page.goto('https://lzecher.com/he/memorial/memorial-0xowxi', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Scroll to and click the קבלות tile
    const kabalosTile = page.locator('text=קבלות').first();
    await kabalosTile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await kabalosTile.click();
    await page.waitForTimeout(1500); // wait for tiles to render

    // Screenshot after click (viewport)
    const clickedSS = path.join(SCREENSHOTS_DIR, `kabalos-tiles-${suffix}.png`);
    await page.screenshot({ path: clickedSS });
    console.log('Saved:', clickedSS);

    // Full page screenshot to see all tiles
    const fullSS = path.join(SCREENSHOTS_DIR, `kabalos-tiles-full-${suffix}.png`);
    await page.screenshot({ path: fullSS, fullPage: true });
    console.log('Saved:', fullSS);

    // Count the tiles
    const tileData = await page.evaluate(() => {
      // Find all "בלי נדר" labels — each represents one kabala tile
      const beliLabels = Array.from(document.querySelectorAll('*')).filter(
        el => el.textContent.trim() === 'בלי נדר' && el.children.length === 0
      );

      // Find all the tile names (headings near "בלי נדר")
      const tileNames = beliLabels.map(label => {
        const parent = label.closest('div, li, article');
        if (parent) {
          const heading = parent.querySelector('h2, h3, h4, p:first-child, [class*="title"]');
          return heading ? heading.textContent.trim() : parent.firstElementChild?.textContent?.trim();
        }
        return null;
      }).filter(Boolean);

      // Find all buttons with "אני מקבל" text
      const buttons = Array.from(document.querySelectorAll('button')).filter(
        btn => btn.textContent.includes('אני מקבל')
      );

      return {
        beliNederCount: beliLabels.length,
        tileNames,
        buttonCount: buttons.length,
        buttonTexts: buttons.map(b => b.textContent.trim()),
        pageContainsBeliNeder: document.body.innerHTML.includes('בלי נדר'),
        pageContainsKabalaAtzmit: document.body.innerHTML.includes('קבלה אישית'),
      };
    });

    console.log(`[${suffix}] Tile data:`, JSON.stringify(tileData, null, 2));

    await page.close();
    return tileData;
  }

  const desktopData = await captureKabalos({ width: 1280, height: 800 }, 'desktop');
  const mobileData = await captureKabalos({ width: 390, height: 844 }, 'mobile');

  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log('Desktop "בלי נדר" count:', desktopData.beliNederCount);
  console.log('Desktop button count:', desktopData.buttonCount);
  console.log('Desktop tile names:', desktopData.tileNames);
  console.log('Desktop button texts:', desktopData.buttonTexts);
  console.log('קבלה אישית present:', desktopData.pageContainsKabalaAtzmit);
  console.log('Mobile "בלי נדר" count:', mobileData.beliNederCount);
})().catch(console.error);
