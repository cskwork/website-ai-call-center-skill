import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

assert.match(read('README.md'), /framework-agnostic/i);
assert.match(read('README.md'), /WASM STT/i);
assert.match(read('README.md'), /GitHub Pages/i);
assert.match(read('skills/website-ai-call-center/SKILL.md'), /^name: website-ai-call-center/m);
assert.match(read('docs/privacy.md'), /What can leave the browser/);
assert.match(read('docs/browser-support.md'), /onnx-community\/distil-small\.en/);
assert.match(read('README.md'), /createWorkerAssetUrls/);
assert.match(read('docs/integration.md'), /Worker asset placement/);
assert.match(read('package.json'), /"build": "vite build && vite build --config vite\.workers\.config\.mjs"/);
assert.match(read('package.json'), /"site:build": "npm run build && node scripts\/build-pages\.mjs"/);
assert.match(read('examples/vanilla/main.js'), /function createSupportScenarioEngine/);
assert.match(read('examples/vanilla/main.js'), /function createSupportActions/);
assert.match(read('examples/vanilla/main.js'), /function createWasmSpeechAdapters/);
assert.match(read('examples/vanilla/main.js'), /onnx-community\/distil-small\.en/);
assert.match(read('examples/vanilla/main.js'), /@diffusionstudio\/piper-wasm@1\.0\.0/);
assert.match(read('site/index.html'), /Add a private AI call-center to any website/);
assert.match(read('site/index.html'), /\.\/examples\/vanilla\/index\.html/);
assert.match(read('site/landing.js'), /onnx-community\/distil-small\.en/);
assert.match(read('site/landing.js'), /createPiperTtsAdapter/);
assert.match(read('.github/workflows/pages.yml'), /actions\/configure-pages@v6/);
assert.match(read('.github/workflows/pages.yml'), /actions\/upload-pages-artifact@v5/);
assert.match(read('.github/workflows/pages.yml'), /actions\/deploy-pages@v5/);
assert.match(read('.github/workflows/pages.yml'), /github\.event\.repository\.private/);
assert.doesNotMatch(read('examples/vanilla/main.js'), /SpeechSynthesis|speechSynthesis|createSpeechSynthesisAdapter/);
assert.doesNotMatch(read('site/landing.js'), /SpeechSynthesis|speechSynthesis|createSpeechSynthesisAdapter/);
assert.doesNotMatch(read('site/index.html'), /(?:href|src)="\//);
assert.doesNotMatch(read('site/styles.css'), /transition:\s*all\b/);

for (const file of requiredFiles()) assert.ok(fs.existsSync(new URL(file, root)), `missing ${file}`);
for (const hit of scanForForbiddenCoupling()) assert.fail(`forbidden coupling in ${hit}`);

if (fs.existsSync(new URL('dist/', root))) {
  assert.ok(fs.existsSync(new URL('dist/website-ai-call-center.esm.js', root)), 'missing ESM build');
  assert.ok(fs.existsSync(new URL('dist/website-ai-call-center.iife.js', root)), 'missing IIFE build');
  assert.ok(fs.existsSync(new URL('dist/website-ai-call-center.css', root)), 'missing CSS build');
}

console.log('validate: ok');

function requiredFiles() {
  return [
    'src/index.js',
    'src/core/create-call-center.js',
    'src/stt/wasm-stt-adapter.js',
    'src/tts/piper-tts-adapter.js',
    'examples/vanilla/index.html',
    'examples/esm-smoke/index.html',
    'skills/website-ai-call-center/references/verification.md',
    '.github/REPO_META.md',
    '.github/workflows/pages.yml',
    'site/index.html',
    'site/styles.css',
    'site/landing.js',
    'site/favicon.svg',
    'scripts/build-pages.mjs',
    'scripts/site-smoke.mjs',
    'jsconfig.json',
  ];
}

function scanForForbiddenCoupling() {
  const terms = ['do' + 'grah', 'workflow_id', '/api/v1/mcp'];
  const dirs = ['src', 'examples', 'docs', 'skills', 'site', 'README.md'];
  const files = dirs.flatMap((entry) => collectPath(path.join(rootPath(), entry)));
  return files.filter((file) => terms.some((term) => fs.readFileSync(file, 'utf8').toLowerCase().includes(term)));
}

function rootPath() {
  return path.resolve(new URL('../', import.meta.url).pathname);
}

function collectPath(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target).flatMap((name) => collectPath(path.join(target, name)));
}
