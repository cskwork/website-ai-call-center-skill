import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const outDir = path.join(root, '_site');

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
await copyDir(path.join(root, 'site'), outDir);
await copyDir(path.join(root, 'dist'), path.join(outDir, 'dist'));
await copyDir(path.join(root, 'examples'), path.join(outDir, 'examples'));
await copyDir(path.join(root, 'docs'), path.join(outDir, 'docs'));
await fs.writeFile(path.join(outDir, '.nojekyll'), '');

await assertFile('index.html');
await assertFile('dist/website-ai-call-center.iife.js');
await assertFile('dist/workers/stt-worker.js');
await assertFile('dist/workers/tts-worker.js');
await assertFile('examples/vanilla/index.html');

console.log('build-pages: ok');

async function copyDir(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

function shouldSkip(entry) {
  return entry.name === '.DS_Store' || entry.isSymbolicLink();
}

async function assertFile(relativePath) {
  const stat = await fs.stat(path.join(outDir, relativePath));
  assert.equal(stat.isFile(), true, `${relativePath} must be a file`);
}
