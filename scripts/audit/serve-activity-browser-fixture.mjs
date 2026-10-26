import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { execFileSync } from 'node:child_process';

const root = process.cwd(), out = path.join(root, 'test-results', 'activity-browser');
fs.mkdirSync(out, { recursive: true });
const baseline = '9eeb42ef5db65eb69f30f60fd2e199b79a641646';
const previous = 'a9ea2afff49c71b2c6ead02fef185af78c17a9cd';
const sources = ['src/components/activity/ActivityBubbles.tsx', 'src/lib/use-site-settings.ts', 'src/lib/activity-format.ts'];
for (const file of sources) {
  if (execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }) !== execFileSync('git', ['show', `${previous}:${file}`], { encoding: 'utf8' })) throw new Error(`Baseline differs: ${file}`);
}
for (const before of [false, true]) await build({ entryPoints: ['scripts/audit/activity-browser-fixture.tsx'], outfile: path.join(out, before ? 'app-baseline.js' : 'app.js'),
  bundle: true, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  plugins: before ? [{ name: 'exact-released-source', setup(builder) {
    builder.onLoad({ filter: /ActivityBubbles\.tsx$|use-site-settings\.ts$|activity-format\.ts$/ }, args => {
      const file = path.relative(root, args.path).replaceAll('\\', '/');
      if (!sources.includes(file)) return;
      return { contents: execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }), loader: file.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(args.path) };
    });
  } }] : [] });
const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.join(root, 'src/app/globals.css') });
fs.writeFileSync(path.join(out, 'app.css'), css.css);
if (process.argv.includes('--build-only')) process.exit(0);
const server = http.createServer((request, response) => {
  const file = ['/app.js', '/app-baseline.js', '/app.css'].includes(request.url) ? request.url.slice(1) : null;
  response.setHeader('Content-Type', file?.endsWith('.js') ? 'text/javascript' : file ? 'text/css' : 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self'");
  const before = request.url === '/?baseline=1';
  response.end(file ? fs.readFileSync(path.join(out, file)) : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><main style="padding:24px;padding-bottom:120px"><h1>Local activity regression tests ${before ? '(released baseline)' : '(fixed)'}</h1><p>Synthetic data only. No live network access.</p><pre id="results" style="white-space:pre-wrap;font-size:12px">Running...</pre></main><div id="fixture"></div><script src="/${before ? 'app-baseline.js' : 'app.js'}"></script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
console.log(`Local actual-component fixture: http://127.0.0.1:${server.address().port}`);
