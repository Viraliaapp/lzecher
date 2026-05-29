import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto("https://lzecher.com/he", { waitUntil: "networkidle", timeout: 40000 });
await p.waitForTimeout(4000); // wait for first bubble to animate in
const t = await p.locator("body").innerText();
console.log("bubble sentence ('לקח/ה ... עבור') present:", /לקח\/ה.*עבור/.test(t));
await p.screenshot({ path: "scripts/audit/prompt-c/home-bubble.png", fullPage: false });
await b.close();
