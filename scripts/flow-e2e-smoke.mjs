import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Full-stack browser e2e for the multi-domain runtime: loads the BUILT SDK in a
// real headless browser, drives a prebuilt P4 template bundle through the P2b
// flow engine + overlay, and asserts the graph conversation (AI disclosure ->
// intent routing -> action node -> handoff) and KO localization work end-to-end
// in-browser. Complements browser-smoke (legacy local-rule-engine path).
const root = path.resolve(new URL('..', import.meta.url).pathname);
const port = 4180;

if (!fs.existsSync(path.join(root, 'dist/website-ai-call-center.iife.js'))) {
  throw new Error('Run "npm run build" before "npm run smoke:flow".');
}

const server = http.createServer((req, res) => serve(req, res));
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch();

  // 1) finance EN: card-lock takes the condition-object edge -> action node + handoff.
  await runConversation(browser, { domain: 'finance', locale: 'en' }, async (page) => {
    await send(page, 'lock my card');
    await page.waitForSelector('text=AI assistant'); // disclosure rendered once
    await page.waitForSelector('text=Connecting you to a person'); // handoff node text
    await page.waitForSelector('.waicc-actions button[data-action-id="start-card-lock"]'); // action node
  });

  // 2) finance KO: bilingual disclosure + KO message via the same graph.
  await runConversation(browser, { domain: 'finance', locale: 'ko' }, async (page) => {
    await send(page, '잔액 알려주세요');
    await page.waitForSelector('text=AI 도우미'); // KO disclosure
    await page.waitForSelector('text=잔액이 표시되는'); // KO balance message node
  });

  // 3) insurance EN: a different template runs on the same engine (config-as-data).
  await runConversation(browser, { domain: 'insurance', locale: 'en' }, async (page) => {
    await send(page, 'coverage');
    await page.waitForSelector('text=coverage details are listed');
  });

  console.log('flow-e2e-smoke: ok');
} finally {
  await browser?.close?.();
  await new Promise((resolve) => server.close(resolve));
}

/**
 * Open a fresh page on the flow-template example for one domain/locale, wait for
 * the SDK to wire up, open the overlay, and run the caller's assertions. A fresh
 * page per conversation keeps each flow session at its start node.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ domain: string, locale: string }} opts
 * @param {(page: import('playwright').Page) => Promise<void>} drive
 */
async function runConversation(browser, { domain, locale }, drive) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${port}/examples/flow-template/index.html?domain=${domain}&locale=${locale}`);
    await page.waitForFunction(() => globalThis.__flowDemo?.ok === true);
    await page.click('#open');
    await page.waitForSelector('.waicc-input');
    await drive(page);
    if (errors.length) throw new Error(`[${domain}/${locale}] console errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 */
async function send(page, text) {
  await page.fill('.waicc-input', text);
  await page.click('[data-waicc="send"]');
}

function serve(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  const filePath = safePath(urlPath === '/' ? '/examples/flow-template/index.html' : urlPath);
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
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
