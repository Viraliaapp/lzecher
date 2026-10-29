import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

// Exercise the real component with synthetic rankings. No production requests.
const root = process.cwd();
const out = path.join(root, 'test-results', 'leaderboard-ui');
fs.mkdirSync(out, { recursive: true });
const catalogs = Object.fromEntries(['en', 'he'].map(locale => [locale, JSON.parse(fs.readFileSync(`messages/${locale}.json`, 'utf8'))]));
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {Leaderboard} from './src/components/activity/Leaderboard';
const query = new URLSearchParams(location.search), locale = query.get('locale') || 'en';
const catalogs = ${JSON.stringify(catalogs)};
const names = locale === 'he'
  ? ['משפחת אהרונוביץ ובני המשפחה', 'אמא אהרונוביץ', 'שלומי', 'דוד', 'אורה', 'אליעזר', 'חיים']
  : ['The Aharonovitch Family and Friends', 'Sarah Aharonovitch', 'Shloimy', 'David', 'Ora', 'Eliezer', 'Chaim'];
const rows = names.map((name, i) => ({name, count: [12345, 88, 17, 14, 12, 10, 9][i]}));
window.fixture = {fail: false, failPoll: query.has('offline'), requests: []};
window.fetch = async (url, options = {}) => {
  if (options.method && options.method !== 'GET') throw Error('Unexpected mutation');
  if (!url.startsWith('/api/projects/fixture/leaderboard')) throw Error('Unexpected request');
  window.fixture.requests.push(url);
  await new Promise(r => setTimeout(r, query.has('slow') ? 10000 : 60));
  const all = url.endsWith('?all=1');
  if (window.fixture.failPoll || (all && window.fixture.fail)) return new Response('{}', {status: 503});
  return new Response(JSON.stringify({matmidim: query.has('empty') ? [] : rows.slice(0, all ? 7 : 5), hasMore: !query.has('empty')}));
};
document.documentElement.lang = locale;
document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
createRoot(document.getElementById('root')).render(
  <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
    <main style={{maxWidth: 1024, margin: '0 auto', padding: 16}}>
      <div style={{display: 'flex', justifyContent: locale === 'he' ? 'flex-start' : 'flex-end'}} dir="ltr">
        <Leaderboard projectId="fixture" initial={query.has('unseeded') ? undefined : query.has('empty') ? [] : rows.slice(0, 5)} />
      </div>
      <section id="following" style={{borderTop: '1px solid #dfcfac', paddingTop: 24, textAlign: 'center', fontSize: 24}}>
        {locale === 'he' ? 'הצטרפו ללימוד' : 'Join the learning'}
      </section>
    </main>
  </NextIntlClientProvider>
);`;
await build({stdin: {contents: entry, loader: 'tsx', resolveDir: root}, bundle: true, platform: 'browser', jsx: 'automatic', outfile: path.join(out, 'app.js'), define: {'process.env.NODE_ENV': '"production"'}});
const css = await postcss([tailwind({base: root})]).process(fs.readFileSync('src/app/globals.css', 'utf8'), {from: path.join(root, 'src/app/globals.css')});
fs.writeFileSync(path.join(out, 'app.css'), css.css);
const server = http.createServer((req, res) => {
  const file = req.url.startsWith('/app.js') ? 'app.js' : req.url.startsWith('/app.css') ? 'app.css' : null;
  res.setHeader('Content-Type', file === 'app.js' ? 'text/javascript' : file ? 'text/css' : 'text/html');
  res.end(file ? fs.readFileSync(path.join(out, file)) : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--font-frank-ruhl:Georgia;--font-inter:Arial}body{background:#FAF6EC}</style><div id="root"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel: 'msedge', headless: true});
const results = [], errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const locale of ['en', 'he']) for (const width of [320, 390, 1280]) {
    await page.setViewportSize({width, height: 900});
    await page.goto(`${origin}/?locale=${locale}`);
    const toggle = page.getByRole('button', {name: catalogs[locale].leaderboard.title, exact: true});
    await toggle.waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByRole('listitem').count(), 0);
    const box = await toggle.boundingBox();
    assert.equal(box.width, 112);
    assert.equal(box.height, 112);
    assert.ok(await toggle.evaluate(button => [...button.children].every(child => {
      const a = child.getBoundingClientRect(), b = button.getBoundingClientRect();
      return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom;
    })), 'label and arrow remain inside medallion');
    await page.screenshot({path: path.join(out, `${locale}-${width}-folded.png`)});
    await toggle.click();
    assert.equal(await page.getByRole('listitem').count(), 5);
    assert.equal(await page.getByRole('list').getAttribute('aria-label'), catalogs[locale].leaderboard.title);
    await page.screenshot({path: path.join(out, `${locale}-${width}-unfolded.png`)});
    const initialRows = await page.getByRole('listitem').allTextContents();
    await page.evaluate(() => { window.fixture.fail = true; });
    const showAll = page.getByRole('button', {name: catalogs[locale].leaderboard.showAll, exact: true});
    await showAll.click();
    await page.waitForFunction(() => !document.querySelector('ol + div button').disabled);
    assert.deepEqual(await page.getByRole('listitem').allTextContents(), initialRows, 'failed expansion preserves top five');
    await page.evaluate(() => { window.fixture.fail = false; });
    await showAll.click();
    await page.waitForFunction(() => document.querySelectorAll('li').length === 7);
    assert.deepEqual((await page.getByRole('listitem').allTextContents()).slice(0, 5), initialRows);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    assert.ok(await page.evaluate(() => document.querySelector('#following').getBoundingClientRect().top >= document.querySelector('[data-testid="yasher-koach"]').getBoundingClientRect().bottom), 'list does not cover following content');
    await page.getByRole('button', {name: catalogs[locale].leaderboard.showTop, exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('li').length === 5);
    await toggle.click();
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('listitem').count(), 5);
    await showAll.click();
    await page.waitForFunction(() => document.querySelectorAll('li').length === 7);
    await toggle.click();
    await toggle.click();
    assert.equal(await page.getByRole('listitem').count(), 5, 'reopen resets to top five');
    results.push(`${locale} ${width}: folded/unfolded, long names, counts, failed expansion, all seven, top five, keyboard, reopen, no overlap`);
  }
  await page.clock.install();
  for (const locale of ['en', 'he']) {
    await page.setViewportSize({width: 320, height: 780});
    const toggle = page.getByRole('button', {name: catalogs[locale].leaderboard.title, exact: true});
    for (const scenario of ['empty', 'slow', 'offline']) {
      await page.goto(`${origin}/?locale=${locale}&unseeded=1&${scenario}=1`);
      await toggle.click();
      await page.clock.runFor(100);
      const key = scenario === 'empty' ? 'empty' : scenario === 'slow' ? 'loading' : 'unavailable';
      assert.equal(await page.getByRole('status').textContent(), catalogs[locale].leaderboard[key]);
      assert.equal(await page.getByRole('listitem').count(), 0);
      assert.equal(await page.getByRole('button', {name: catalogs[locale].leaderboard.showAll, exact: true}).count(), 0);
      await page.screenshot({path: path.join(out, `${locale}-320-${scenario}.png`)});
      if (scenario === 'offline') {
        await page.evaluate(() => { window.fixture.failPoll = false; });
        await page.clock.runFor(20100);
        assert.equal(await page.getByRole('listitem').count(), 5, 'automatic retry restores rankings');
        const before = await page.getByRole('listitem').allTextContents();
        await page.evaluate(() => { window.fixture.failPoll = true; });
        await page.clock.runFor(20100);
        assert.deepEqual(await page.getByRole('listitem').allTextContents(), before, 'failed refresh preserves loaded names');
        assert.equal(await toggle.isVisible(), true);
      } else if (scenario === 'slow') {
        await page.clock.runFor(10100);
        assert.equal(await page.getByRole('listitem').count(), 5, 'slow first load reveals rankings');
      }
      results.push(`${locale} 320: ${scenario} keeps medallion visible with localized status and no invented participants`);
    }
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({results, errors}, null, 2));
  console.log(JSON.stringify({passed: results.length, results, errors}, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
