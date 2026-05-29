import assert from 'node:assert/strict';
import test from 'node:test';

import { bundleToFlow, flowToBundle } from '../src/lib/flow-bundle.js';
import { makeEmptyBundle } from '../src/lib/empty-bundle.js';

/** Hand-authored clean flow: node.type === node.data.type, viewport present. */
function authoredFlow() {
  return {
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      {
        id: 'n_msg',
        type: 'message',
        position: { x: 200, y: 0 },
        data: { type: 'message', text: 'Welcome!', i18n: { ko: { text: '환영합니다!' } } },
      },
      {
        id: 'n_branch',
        type: 'intent-branch',
        position: { x: 400, y: 0 },
        data: { type: 'intent-branch', fallback: 'No match.' },
      },
      {
        id: 'n_billing',
        type: 'message',
        position: { x: 600, y: 0 },
        data: { type: 'message', text: 'Here is your billing info.' },
      },
      { id: 'n_end', type: 'end', position: { x: 800, y: 0 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'n_start', target: 'n_msg' },
      { id: 'e2', source: 'n_msg', target: 'n_branch' },
      { id: 'e3', source: 'n_branch', target: 'n_billing', data: { intent: 'billing' } },
      { id: 'e4', source: 'n_billing', target: 'n_end' },
    ],
    viewport: { x: 12, y: -8, zoom: 1.5 },
  };
}

test('round-trip: bundleToFlow then flowToBundle returns flow deep-equal to original', () => {
  const bundle = { ...makeEmptyBundle(), flow: authoredFlow() };
  const flow = bundleToFlow(bundle);
  const out = flowToBundle(bundle, flow);
  assert.deepStrictEqual(out.flow, bundle.flow);
  assert.notStrictEqual(out, bundle);
  assert.notStrictEqual(out.flow, bundle.flow);
});

test('flowToBundle strips React-Flow runtime-only node fields', () => {
  const flow = {
    nodes: [
      {
        id: 'n1',
        type: 'message',
        position: { x: 5, y: 9 },
        data: { type: 'message', text: 'hi' },
        selected: true,
        dragging: false,
        measured: { width: 160, height: 40 },
        width: 160,
        height: 40,
        positionAbsolute: { x: 5, y: 9 },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const out = flowToBundle(makeEmptyBundle(), flow);
  assert.deepStrictEqual(Object.keys(out.flow.nodes[0]).sort(), ['data', 'id', 'position', 'type']);
  assert.deepStrictEqual(Object.keys(out.flow.nodes[0].position).sort(), ['x', 'y']);
});

test('flowToBundle strips runtime-only edge fields and keeps data only when present', () => {
  const flow = {
    nodes: [],
    edges: [
      { id: 'e1', source: 'a', target: 'b', selected: true, animated: true, style: { stroke: 'red' } },
      { id: 'e2', source: 'b', target: 'c', data: { intent: 'billing' }, selected: false },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const out = flowToBundle(makeEmptyBundle(), flow);
  assert.deepStrictEqual(Object.keys(out.flow.edges[0]).sort(), ['id', 'source', 'target']);
  assert.deepStrictEqual(Object.keys(out.flow.edges[1]).sort(), ['data', 'id', 'source', 'target']);
  assert.deepStrictEqual(out.flow.edges[1].data, { intent: 'billing' });
});

test('bundleToFlow yields default viewport for empty or missing flow', () => {
  const empty = bundleToFlow({ ...makeEmptyBundle(), flow: { nodes: [], edges: [], viewport: undefined } });
  assert.deepStrictEqual(empty, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

  const noFlow = makeEmptyBundle();
  delete noFlow.flow;
  assert.deepStrictEqual(bundleToFlow(noFlow), { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
});

test('bundleToFlow is immutable: mutating the result does not affect the bundle', () => {
  const bundle = { ...makeEmptyBundle(), flow: authoredFlow() };
  const flow = bundleToFlow(bundle);
  flow.nodes[0].data.text = 'mutated';
  flow.nodes.push({ id: 'injected' });
  assert.notStrictEqual(bundle.flow.nodes[0].data.text, 'mutated');
  assert.strictEqual(bundle.flow.nodes.length, 5);
});
