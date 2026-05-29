import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBundle } from '../src/lib/validate-bundle.js';
import { makeEmptyBundle } from '../src/lib/empty-bundle.js';

test('a hand-authored graph bundle is schema-valid', () => {
  const bundle = {
    ...makeEmptyBundle(),
    flow: {
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
        { id: 'n_msg', type: 'message', position: { x: 200, y: 0 }, data: { type: 'message', text: 'Hi' } },
        { id: 'n_end', type: 'end', position: { x: 400, y: 0 }, data: { type: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_msg' },
        { id: 'e2', source: 'n_msg', target: 'n_end' },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
  const result = validateBundle(bundle);
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors, null, 2));
  assert.deepStrictEqual(result.errors, []);
});

test('the empty-bundle skeleton validates (fresh canvas is exportable)', () => {
  const result = validateBundle(makeEmptyBundle());
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test('a malformed bundle reports friendly errors', () => {
  const bundle = makeEmptyBundle();
  bundle.tenant.id = 'Acme Bank'; // bad pattern (uppercase + space)
  delete bundle.intentModel; // missing required top-level field
  const result = validateBundle(bundle);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
  for (const err of result.errors) {
    assert.strictEqual(typeof err.path, 'string');
    assert.ok(err.message.length > 0);
  }
  assert.ok(result.errors.some((e) => e.path === '/tenant/id'), JSON.stringify(result.errors));
  assert.ok(
    result.errors.some((e) => /intentModel/i.test(e.message)),
    JSON.stringify(result.errors),
  );
});

test('Ajv resolves the call-scenario $ref by absolute $id (scenario errors surface)', () => {
  const bundle = makeEmptyBundle();
  delete bundle.scenarios[0].workflow; // a call-scenario required field
  const result = validateBundle(bundle);
  assert.strictEqual(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.path.startsWith('/scenarios/0')),
    JSON.stringify(result.errors),
  );
});
