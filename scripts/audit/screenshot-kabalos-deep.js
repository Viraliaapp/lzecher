// Navigate into kabalos track on the memorial page to find individual kabala tiles
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

  // Click "לחצו לבחור פרק" under קבלות
  const kabalosTile = page.locator('text=קבלות').first();
  await kabalosTile.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // Find the link inside the kabalos card
  const kabalaLink = page.locator('a:has-text("לחצו לבחור פרק")').nth(1); // second = kabalos (0=tehilim, 1=kabalos, 2=mishnayot based on visual order)
  let kabalaHref = null;
  try {
    kabalaHref = await kabalaLink.getAttribute('href');
    console.log('Kabalos link href:', kabalaHref);
  } catch (err) {
    console.warn('Could not get kabalos link:', err.message);
  }

  // Also check all "לחצו לבחור פרק" links
  const allLinks = await page.$$eval('a:has-text("לחצו לבחור פרק"), a:has-text("לבחור פרק")', els =>
    els.map(a => ({ href: a.href, text: a.textContent.trim(), parentText: a.parentElement?.textContent?.trim()?.slice(0, 80) }))
  );
  console.log('All track links:', JSON.stringify(allLinks, null, 2));

  // Navigate to kabalos sub-page if we found it
  if (kabalaHref) {
    const fullUrl = kabalaHref.startsWith('http') ? kabalaHref : `https://lzecher.com${kabalaHref}`;
    console.log('Navigating to kabalos sub-page:', fullUrl);
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'kabalos-subpage-desktop.png') });
    console.log('Saved: kabalos-subpage-desktop.png');

    const html = await page.content();
    console.log('beli_neder:', html.includes('בלי נדר'));
    console.log('kabala_atzmit:', html.includes('קבלה אישית'));
    console.log('button_text:', html.includes('אני מקבל'));

    // Count individual kabala tiles
    const pageText = await page.evaluate(() => {
      const allText = Array.from(document.querySelectorAll('h2, h3, p, button, [role="button"]'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0 && /[א-ת]/.test(t));
      return [...new Set(allText)];
    });
    console.log('Hebrew text elements on kabalos sub-page:', JSON.stringify(pageText, null, 2));

    // Full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'kabalos-subpage-full-desktop.png'), fullPage: true });
    console.log('Saved: kabalos-subpage-full-desktop.png');
  } else {
    // Try clicking the kabalos card directly
    console.log('Trying to click the kabalos card...');
    await kabalosTile.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'after-kabalos-click.png') });
    console.log('Saved: after-kabalos-click.png');
    console.log('URL after click:', page.url());
  }

  // Also try mobile viewport on the sub-page
  if (kabalaHref) {
    const fullUrl = kabalaHref.startsWith('http') ? kabalaHref : `https://lzecher.com${kabalaHref}`;
    const mobilePage = await browser.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'kabalos-subpage-mobile.png'), fullPage: true });
    console.log('Saved: kabalos-subpage-mobile.png');
    await mobilePage.close();
  }

  await browser.close();
})().catch(console.error);
