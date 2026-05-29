// Check stat lines on the home page cards in detail
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://lzecher.com/he', { waitUntil: 'networkidle', timeout: 30000 });

  // Get full text of each memorial card
  const cards = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/memorial/"]'));
    return links.map(card => {
      const allTextNodes = [];
      const walk = (el) => {
        if (el.nodeType === 3 && el.textContent.trim()) {
          allTextNodes.push(el.textContent.trim());
        }
        for (const child of el.childNodes) walk(child);
      };
      walk(card);
      return {
        href: card.href,
        texts: allTextNodes,
        fullText: card.innerText,
      };
    });
  });

  cards.forEach((card, i) => {
    console.log(`\nCard ${i + 1}: ${card.href}`);
    console.log('  Texts:', JSON.stringify(card.texts));
    console.log('  Full text:', JSON.stringify(card.fullText));
  });

  // Check where "ממשיכים להצטרף" actually appears in the rendered DOM
  const mamContext = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll('*'));
    const results = [];
    for (const el of allEls) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        if (el.textContent.includes('ממשיכים להצטרף')) {
          results.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            visible: el.offsetParent !== null,
            style: window.getComputedStyle(el).display,
          });
        }
      }
    }
    return results;
  });
  console.log('\n"ממשיכים להצטרף" elements in DOM:', JSON.stringify(mamContext, null, 2));

  await browser.close();
})().catch(console.error);
