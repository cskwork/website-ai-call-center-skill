import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const siteRoot = path.join(root, '_site');
const port = 4178;
const errors = [];

if (!fs.existsSync(path.join(siteRoot, 'index.html'))) {
  throw new Error('Run npm run site:build before npm run smoke:site.');
}

const server = http.createServer((req, res) => serve(req, res));
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('text=Add a private AI call-center to any website.');
  await page.click('#launch-demo');
  await page.fill('.waicc-input', 'I cannot hear audio during a support call');
  await page.click('[data-waicc="send"]');
  await page.waitForSelector('text=I can guide audio setup');
  await page.click('.waicc-actions button[data-action-id="show-audio"]');
  await page.waitForFunction(() => document.querySelector('#target-audio')?.classList.contains('waicc-highlight'));
  await page.click('[data-check="wasm"]');
  await page.waitForSelector('[data-check-row="wasm"][data-check-state="pass"]');
  await page.click('[data-tab="actions"]');
  await page.waitForSelector('#panel-actions:not([hidden])');
  await page.goto(`http://127.0.0.1:${port}/examples/vanilla/index.html`);
  await page.waitForSelector('text=Framework-agnostic AI call center overlay');

  if (errors.length) throw new Error(`Browser console errors:\n${errors.join('\n')}`);
  console.log('site-smoke: ok');
} finally {
  await browser?.close?.();
  await new Promise((resolve) => server.close(resolve));
}

function serve(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  const filePath = safePath(urlPath === '/' ? '/index.html' : urlPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function safePath(urlPath) {
  const target = path.resolve(siteRoot, `.${urlPath}`);
  const relative = path.relative(siteRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  return 'application/octet-stream';
}
