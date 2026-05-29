import { chromium } from 'playwright';
import Ajv2020 from 'ajv/dist/2020.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// End-to-end smoke for the built no-code admin SPA: serve admin/dist in a real
// headless browser, render the builder, add a node from the palette, export, and
// assert the DOWNLOADED bundle is schema-valid. Proves the P3 builder produces a
// config bundle the P0 schema accepts. Mirrors scripts/site-smoke.mjs idiom.
const adminRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repoRoot = path.resolve(adminRoot, '..');
const distDir = path.join(adminRoot, 'dist');
const port = 4179;

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('Run "npm run build --prefix admin" before "npm run smoke --prefix admin".');
}

const validateBundle = compileBundleValidator();
const server = http.createServer((req, res) => serve(req, res));
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const consoleErrors = [];
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (message) => {
    // React Flow logs a benign notice when measuring; ignore it, fail on the rest.
    if (message.type() === 'error' && !/width and a height|nodeTypes|edgeTypes/.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('header.toolbar');
  await page.waitForSelector('aside.palette button.palette-block');
  await page.waitForSelector('.react-flow');

  // Canvas starts empty; adding a node from the palette renders exactly one node.
  // The first palette element is now a help tip, so target the block buttons.
  if ((await page.locator('.react-flow__node').count()) !== 0) {
    throw new Error('expected an empty canvas on load');
  }
  await page.locator('aside.palette button.palette-block').first().click();
  await page.waitForSelector('.react-flow__node');
  if ((await page.locator('.react-flow__node').count()) !== 1) {
    throw new Error('expected exactly one node after adding from the palette');
  }

  // Export -> validate -> download. Assert the success banner AND a schema-valid file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  await page.waitForSelector('.banner-ok');

  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  if (!validateBundle(exported)) {
    throw new Error(`exported bundle failed schema validation: ${JSON.stringify(validateBundle.errors, null, 2)}`);
  }
  if (exported.flow?.nodes?.length !== 1) {
    throw new Error('exported flow should contain the one added node');
  }

  // Start-from-template: loading a prebuilt template fills the canvas with its
  // multi-node working flow, and that flow still exports schema-valid.
  await page.selectOption('.template-picker select', 'finance');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 1);
  const [templateDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  const templateBundle = JSON.parse(fs.readFileSync(await templateDownload.path(), 'utf8'));
  if (!validateBundle(templateBundle)) {
    throw new Error(`exported template failed schema validation: ${JSON.stringify(validateBundle.errors, null, 2)}`);
  }
  if ((templateBundle.flow?.nodes?.length ?? 0) <= 1) {
    throw new Error('loaded template should export its multi-node flow');
  }

  // Multilingual: switching to Korean localizes the chrome; switch back to English.
  await page.getByRole('button', { name: '한국어' }).click();
  await page.waitForSelector('text=플로우 테스트');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Test flow', exact: true }).waitFor();

  // Tooltips: hovering a help affordance reveals its bubble.
  await page.locator('button.tip-trigger').first().hover();
  await page.waitForSelector('.tip-bubble');
  await page.mouse.move(0, 0); // dismiss the hover tooltip

  // Live test: run the loaded finance flow in the real assistant overlay, send a
  // typed message, and assert the engine replies. Proves the builder->runtime path
  // end to end without exporting (text mode downloads no models).
  await page.getByRole('button', { name: 'Test flow', exact: true }).click();
  await page.waitForSelector('.test-panel');
  await page.waitForSelector('.test-mount .waicc-fab');
  await page.getByRole('button', { name: 'Open assistant', exact: true }).click();
  await page.waitForSelector('.test-mount .waicc-input:visible');
  await page.fill('.test-mount .waicc-input', 'I want to check my account balance');
  await page.click('.test-mount .waicc-send');
  await page.waitForSelector('.test-mount .waicc-message.waicc-assistant');
  const reply = (await page.locator('.test-mount .waicc-message.waicc-assistant').first().innerText()).trim();
  if (!reply) throw new Error('live test: assistant produced an empty reply');

  // Voice toggle: enabling it rebuilds the center with the real WASM speech
  // adapters (no model download until Prepare). Assert the path mounts cleanly and
  // disposes the prior center; then switch back to text mode.
  await page.locator('.test-voice input[type="checkbox"]').check();
  await page.waitForSelector('.test-mount .waicc-fab');
  await page.locator('.test-voice input[type="checkbox"]').uncheck();
  await page.waitForSelector('.test-mount .waicc-fab');

  if (consoleErrors.length) throw new Error(`browser console errors:\n${consoleErrors.join('\n')}`);
  console.log('admin-smoke: ok');
} finally {
  await browser?.close?.();
  await new Promise((resolve) => server.close(resolve));
}

function compileBundleValidator() {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(readJson(path.join(repoRoot, 'schemas/call-scenario.schema.json')));
  return ajv.compile(readJson(path.join(repoRoot, 'schemas/config-bundle.schema.json')));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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
  const target = path.resolve(distDir, `.${urlPath}`);
  const relative = path.relative(distDir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
