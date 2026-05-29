import assert from 'node:assert/strict';
import test from 'node:test';

import { flowToBundle, bundleToFlow } from '../src/lib/flow-bundle.js';
import { makeEmptyBundle } from '../src/lib/empty-bundle.js';

function sampleFlow() {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'message',
        position: { x: 1, y: 2 },
        data: { type: 'message', text: 'hi' },
        selected: true,
        measured: { width: 100, height: 30 },
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { intent: 'x' }, selected: true }],
    viewport: { x: 3, y: 4, zoom: 1.2 },
  };
}

test('flowToBundle does not mutate baseBundle or flow inputs', () => {
  const base = makeEmptyBundle();
  const flow = sampleFlow();
  const baseSnapshot = JSON.stringify(base);
  const flowSnapshot = JSON.stringify(flow);

  const out = flowToBundle(base, flow);

  assert.strictEqual(JSON.stringify(base), baseSnapshot);
  assert.strictEqual(JSON.stringify(flow), flowSnapshot);
  // Returned graph uses new references, not the inputs.
  assert.notStrictEqual(out.flow.nodes, flow.nodes);
  assert.notStrictEqual(out.flow.nodes[0], flow.nodes[0]);
  assert.notStrictEqual(out.flow, base.flow);
});

test('flowToBundle tolerates frozen inputs without throwing', () => {
  const base = Object.freeze(makeEmptyBundle());
  const flow = Object.freeze(sampleFlow());
  assert.doesNotThrow(() => flowToBundle(base, flow));
});

test('bundleToFlow does not mutate the source bundle', () => {
  const bundle = { ...makeEmptyBundle(), flow: { nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } };
  const snapshot = JSON.stringify(bundle);
  const flow = bundleToFlow(bundle);
  flow.nodes[0].data.type = 'mutated';
  assert.strictEqual(JSON.stringify(bundle), snapshot);
});
