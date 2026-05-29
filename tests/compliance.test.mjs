import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFlowEngine } from '../src/api.js';

// Compliance surface (PRD G5): every shipped bundle must carry the AI-use
// disclosure and the written-governance documentation block, and the disclosure
// must actually render once on the first interaction at runtime. These are an
// enforced contract, not just optional schema fields.
const root = new URL('../', import.meta.url);
const readJson = (file) => JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));
const listBundles = () =>
  fs.readdirSync(new URL('bundles/', root)).filter((name) => name.endsWith('.bundle.json')).sort();

const SHOW_ON = new Set(['first-interaction', 'every-session', 'off']);

test('every shipped bundle carries a complete written-governance block', () => {
  for (const name of listBundles()) {
    const { governance } = readJson(`bundles/${name}`);
    assert.ok(governance, `${name}: missing governance block`);
    assert.ok(typeof governance.owner === 'string' && governance.owner.length > 0, `${name}: governance.owner`);
    assert.equal(typeof governance.modelVersions, 'object', `${name}: governance.modelVersions`);
    assert.ok(governance.modelVersions && governance.modelVersions !== null, `${name}: governance.modelVersions null`);
    assert.match(governance.lastReviewed ?? '', /^\d{4}-\d{2}-\d{2}$/, `${name}: governance.lastReviewed must be YYYY-MM-DD`);
    assert.ok(typeof governance.notes === 'string' && governance.notes.length > 0, `${name}: governance.notes`);
  }
});

test('every shipped bundle requires a bilingual AI-use disclosure', () => {
  for (const name of listBundles()) {
    const { disclosure } = readJson(`bundles/${name}`);
    assert.ok(disclosure, `${name}: missing disclosure`);
    assert.equal(disclosure.required, true, `${name}: disclosure.required must be true`);
    assert.ok(SHOW_ON.has(disclosure.showOn), `${name}: disclosure.showOn invalid (${disclosure.showOn})`);
    for (const locale of ['en', 'ko']) {
      assert.ok(disclosure.text?.[locale]?.length > 0, `${name}: disclosure.text.${locale} missing`);
    }
  }
});

test('the AI disclosure renders once on the first interaction for every bundle', async () => {
  for (const name of listBundles()) {
    const bundle = readJson(`bundles/${name}`);
    const engine = createFlowEngine({ bundle });
    await engine.startSession();
    const first = await engine.sendUserText('zzz unrecognized opening line');
    assert.ok(
      first.text.includes(bundle.disclosure.text.en),
      `${name}: disclosure must appear on the first interaction`,
    );
    const second = await engine.sendUserText('zzz another line');
    assert.ok(
      !second.text.includes(bundle.disclosure.text.en),
      `${name}: disclosure must not repeat after the first interaction`,
    );
  }
});
