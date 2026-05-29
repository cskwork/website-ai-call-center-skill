import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { validateBundle } from '../src/lib/validate-bundle.js';
import { bundleToFlow } from '../src/lib/flow-bundle.js';

// The Flow Builder offers these prebuilt bundles as starter templates. Each must be
// schema-valid and produce a non-empty graph the canvas can render, so a new user
// lands on a working flow rather than a blank page. (support is excluded on purpose:
// it ships an empty flow for the legacy keyword path.)
const TEMPLATE_IDS = ['finance', 'education', 'insurance'];

function readBundle(id) {
  return JSON.parse(fs.readFileSync(new URL(`../../bundles/${id}.bundle.json`, import.meta.url), 'utf8'));
}

for (const id of TEMPLATE_IDS) {
  test(`${id} template is a schema-valid, multi-node working flow`, () => {
    const bundle = readBundle(id);

    const result = validateBundle(bundle);
    assert.ok(result.valid, `${id} bundle invalid: ${JSON.stringify(result.errors)}`);

    const flow = bundleToFlow(bundle);
    assert.ok(flow.nodes.length > 1, `${id} template must render a multi-node flow`);
    assert.ok(flow.edges.length >= 1, `${id} template must have at least one edge`);

    // Onboarding-ready: every starter template carries the compliance floor.
    assert.ok(bundle.disclosure?.text?.en && bundle.disclosure?.text?.ko, `${id} needs bilingual disclosure`);
    assert.ok(bundle.governance?.owner, `${id} needs a governance owner`);
  });
}

test('starter flows round-trip through bundleToFlow without losing nodes', () => {
  for (const id of TEMPLATE_IDS) {
    const bundle = readBundle(id);
    const flow = bundleToFlow(bundle);
    assert.equal(flow.nodes.length, bundle.flow.nodes.length, `${id} node count preserved`);
  }
});
