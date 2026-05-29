const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ── HOME PAGE ──
  const p1 = await browser.newPage();
  await p1.goto('https://lzecher.com/he', { waitUntil: 'networkidle', timeout: 30000 });
  const homeHtml = await p1.content();

  const mamIdx = homeHtml.indexOf('ממשיכים להצטרף'); // ממשיכים להצטרף
  if (mamIdx >= 0) {
    console.log('HOME mamshikhim context:', homeHtml.slice(Math.max(0, mamIdx - 150), mamIdx + 150));
  }

  // Card bottom stat lines
  const cardTexts = await p1.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a[href*="/memorial/"]'));
    return cards.map(card => {
      const ps = Array.from(card.querySelectorAll('p, span'));
      return ps.map(el => el.textContent.trim()).filter(t => t.length > 0);
    });
  });
  console.log('\nCard text samples (first 3 cards):');
  cardTexts.slice(0, 3).forEach((c, i) => {
    console.log(`  Card ${i + 1}:`, JSON.stringify(c));
  });

  await p1.close();

  // ── MEMORIAL PAGE ──
  const p2 = await browser.newPage();
  await p2.goto('https://lzecher.com/he/memorial/memorial-0xowxi', { waitUntil: 'networkidle', timeout: 30000 });
  const memHtml = await p2.content();

  // Search for key kabalos text
  const searches = [
    'קבלות', // קבלות
    'בלי נדר', // בלי נדר
    'מקבל', // מקבל
    'קבלה אישית', // קבלה אישית
    'קבלהה', // קבלהה (just in case)
  ];

  for (const term of searches) {
    const idx = memHtml.indexOf(term);
    if (idx >= 0) {
      console.log(`\nFound "${term}" at index ${idx}:`);
      console.log(memHtml.slice(Math.max(0, idx - 100), idx + 200));
    } else {
      console.log(`\n"${term}" NOT FOUND in page HTML`);
    }
  }

  // Get all visible text blocks on the page
  const allText = await p2.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const texts = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (t.length > 3 && /[א-ת]/.test(t)) {
        texts.push(t);
      }
    }
    return [...new Set(texts)];
  });

  console.log('\n\nAll Hebrew text on memorial page:');
  allText.forEach(t => console.log(' -', t));

  await p2.close();
  await browser.close();
})().catch(console.error);
