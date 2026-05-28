import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const port = 4177;

if (!fs.existsSync(path.join(root, 'dist/website-ai-call-center.iife.js'))) {
  throw new Error('Run npm run build before npm run smoke:browser.');
}

const server = http.createServer((req, res) => serve(req, res));
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/examples/vanilla/index.html`);
  await page.click('#demo-open');
  await page.fill('.waicc-input', 'I need account help');
  await page.click('[data-waicc="send"]');
  await page.waitForSelector('text=I found the account path');
  await page.click('.waicc-actions button[data-action-id="show-account"]');
  await page.waitForFunction(() => document.querySelector('#account')?.classList.contains('waicc-highlight'));
  await page.fill('.waicc-input', 'My internet page says offline and I need diagnostics');
  await page.click('[data-waicc="send"]');
  await page.waitForSelector('text=Let us check the connection state');
  await page.click('.waicc-actions button[data-action-id="run-diagnostics"]');
  await page.waitForSelector('text=Browser reports');
  await page.click('.waicc-close');
  await page.waitForSelector('.waicc-panel', { state: 'hidden' });
  await assertFocusStaysInDialog(page);
  await page.goto(`http://127.0.0.1:${port}/examples/esm-smoke/index.html`);
  await page.waitForFunction(() => window.__esmSmoke?.ok === true);
  console.log('browser-smoke: ok');
} finally {
  await browser?.close?.();
  await new Promise((resolve) => server.close(resolve));
}

/**
 * Regression for the modal focus-trap fix: when the focused End button hides on
 * endCall (state -> 'ended'), focus must stay inside the open dialog, never fall
 * to document.body (WCAG 2.4.3). Uses noop adapters so prepare resolves offline.
 *
 * @param {import('playwright').Page} page
 */
async function assertFocusStaysInDialog(page) {
  const result = await page.evaluate(async () => {
    const sdk = window.WebsiteAICallCenter;
    const center = sdk.createWebsiteCallCenter({});
    const roots = document.querySelectorAll('.waicc-root');
    const root = roots[roots.length - 1]; // the overlay just created above
    root.querySelector('.waicc-fab').click();
    await center.prepare();
    const end = root.querySelector('[data-waicc="end"]');
    if (!end || end.hidden) return { error: 'End button not visible after prepare' };
    end.focus();
    end.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const panel = root.querySelector('.waicc-panel');
    const active = document.activeElement;
    const inside = !!active && active !== document.body && panel.contains(active);
    center.destroy();
    return { inside, endHidden: end.hidden };
  });
  if (result.error) throw new Error(`focus-trap regression: ${result.error}`);
  if (!result.endHidden) throw new Error('focus-trap regression: End button did not hide on endCall');
  if (!result.inside) throw new Error('focus-trap regression: focus escaped the dialog when End hid');
}

function serve(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  const filePath = safePath(urlPath === '/' ? '/examples/vanilla/index.html' : urlPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function safePath(urlPath) {
  const target = path.resolve(root, `.${urlPath}`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}
