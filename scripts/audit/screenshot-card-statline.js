// Screenshot memorial-ay5ukw card (has full 4-part stat line) and the home page cards
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://lzecher.com/he', { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll to show the cards section
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(400);

  // Screenshot showing cards with stat lines
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'home-cards-statlines.png') });
  console.log('Saved: home-cards-statlines.png');

  // Find the card with 4-part stat line and clip it
  const card5 = page.locator('a[href*="memorial-ay5ukw"]').first();
  const c5 = await card5.count();
  if (c5 > 0) {
    const box = await card5.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'card-ay5ukw-4part-statline.png'),
        clip: box,
      });
      console.log('Saved: card-ay5ukw-4part-statline.png (full 4-part stat line card)');
    }
  }

  // Scroll to see all 6 cards
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'home-cards-scrolled.png') });
  console.log('Saved: home-cards-scrolled.png');

  await browser.close();
})().catch(console.error);
