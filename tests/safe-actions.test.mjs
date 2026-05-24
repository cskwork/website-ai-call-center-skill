import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeActionRegistry, createSelectorAction } from '../src/actions/safe-actions.js';

test('safe action registry executes only registered actions', async () => {
  let ran = false;
  const registry = createSafeActionRegistry({ known: () => { ran = true; } });
  assert.deepEqual(await registry.execute('missing'), { ok: false, id: 'missing', reason: 'unregistered_action' });
  assert.equal((await registry.execute('known')).ok, true);
  assert.equal(ran, true);
});

test('selector actions reject unsafe selectors', () => {
  assert.throws(() => createSelectorAction({ id: 'bad', selector: 'body script' }), /Unsafe selector/);
  assert.equal(createSelectorAction({ id: 'ok', selector: '#help' }).id, 'ok');
});
