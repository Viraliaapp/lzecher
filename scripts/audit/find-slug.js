const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://lzecher.vercel.app/he/memorials", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/memorial/"]')).map((e) => e.href)
  );
  const slugs = [...new Set(links.map((l) => (l.match(/\/memorial\/([^/?#]+)/) || [])[1]).filter(Boolean))];
  console.log(JSON.stringify(slugs.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
