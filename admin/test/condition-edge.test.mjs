import assert from 'node:assert/strict';
import test from 'node:test';

import { createFlowEngine } from '../../src/api.js';
import { bundleToFlow, flowToBundle } from '../src/lib/flow-bundle.js';
import { validateBundle } from '../src/lib/validate-bundle.js';
import { makeEmptyBundle } from '../src/lib/empty-bundle.js';

const DISCLOSURE = 'You are chatting with an AI assistant.';

/** Base bundle: a 'billing' intent the keyword resolver can match (threshold 0). */
function billingBundle() {
  return {
    ...makeEmptyBundle(),
    disclosure: { required: false, showOn: 'first-interaction', text: { en: DISCLOSURE } },
    intentModel: { resolver: 'keyword', threshold: 0, model: null },
    intents: [{ id: 'billing', utterances: ['I need billing help'], scenario: 'billing' }],
    scenarios: [
      {
        id: 'billing',
        scenario_intent: 'billing',
        title: 'Billing',
        button_label: 'Billing help',
        summary: 'Billing scenario.',
        utterances: ['I need billing help'],
        match: { keywords: ['billing', 'invoice'] },
        reply: { text: 'Billing reply.' },
        frontend_actions: [{ id: 'show-billing', label: 'Show billing' }],
        workflow: { issue_type: 'billing', handoff: false },
      },
    ],
  };
}

/**
 * React-Flow graph whose intent-branch routes by a CONDITION written as raw
 * textarea JSON (the inspector's editable form). The condition is true only when
 * the resolved intent equals `conditionIntent`; otherwise the default edge wins.
 */
function conditionRoutedGraph(conditionString) {
  return {
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'n_branch', type: 'intent-branch', position: { x: 150, y: 0 }, data: { type: 'intent-branch', fallback: 'No match.' } },
      { id: 'n_cond', type: 'message', position: { x: 300, y: 0 }, data: { type: 'message', text: 'Condition true branch.' } },
      { id: 'n_def', type: 'message', position: { x: 300, y: 120 }, data: { type: 'message', text: 'Default branch.' } },
      { id: 'n_end', type: 'end', position: { x: 450, y: 0 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'e_start', source: 'n_start', target: 'n_branch' },
      // Condition edge authored exactly as the inspector stores it: a raw STRING.
      { id: 'e_cond', source: 'n_branch', target: 'n_cond', data: { condition: conditionString } },
      // Default/fallback edge (no routing).
      { id: 'e_def', source: 'n_branch', target: 'n_def' },
      { id: 'e_cend', source: 'n_cond', target: 'n_end' },
      { id: 'e_dend', source: 'n_def', target: 'n_end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

test('flowToBundle materializes a condition string into the engine expression object', () => {
  const graph = conditionRoutedGraph('{"==": [{"var": "intent"}, "billing"]}');
  const bundle = flowToBundle(billingBundle(), graph);
  const condEdge = bundle.flow.edges.find((e) => e.id === 'e_cond');
  assert.strictEqual(typeof condEdge.data.condition, 'object');
  assert.deepStrictEqual(condEdge.data.condition, { '==': [{ var: 'intent' }, 'billing'] });
  assert.strictEqual(validateBundle(bundle).valid, true, JSON.stringify(validateBundle(bundle).errors));
});

test('flowToBundle throws a friendly error for unparseable condition JSON (blocks export)', () => {
  const graph = conditionRoutedGraph('{"==": [oops');
  assert.throws(() => flowToBundle(billingBundle(), graph), /invalid condition.*valid JSON/);
});

test('engine round-trip: condition edge is taken ONLY when the expression is genuinely true', async () => {
  // Condition true: intent === 'billing'. Matching input must take the TRUE branch.
  const bundle = flowToBundle(billingBundle(), conditionRoutedGraph('{"==": [{"var": "intent"}, "billing"]}'));
  const engine = createFlowEngine({ bundle, locale: 'en' });
  await engine.startSession();
  const out = await engine.sendUserText('I need billing help with my invoice');
  assert.strictEqual(out.intent, 'billing');
  assert.match(out.text, /Condition true branch\./);
  assert.doesNotMatch(out.text, /Default branch\./);
});

test('engine round-trip: a condition authored to be FALSE falls to the default edge', async () => {
  // Condition can never be true (intent is at most 'billing', never 'nonexistent').
  const bundle = flowToBundle(billingBundle(), conditionRoutedGraph('{"==": [{"var": "intent"}, "nonexistent"]}'));
  const engine = createFlowEngine({ bundle, locale: 'en' });
  await engine.startSession();
  const out = await engine.sendUserText('I need billing help with my invoice');
  assert.strictEqual(out.intent, 'billing');
  assert.match(out.text, /Default branch\./);
  assert.doesNotMatch(out.text, /Condition true branch\./);
});

test('blank intent/condition edge is stripped to a default edge (no dead route)', () => {
  const flow = {
    nodes: [],
    edges: [
      { id: 'e_blank_intent', source: 'a', target: 'b', data: { intent: '' } },
      { id: 'e_blank_cond', source: 'a', target: 'c', data: { condition: '   ' } },
      { id: 'e_real', source: 'a', target: 'd', data: { intent: 'billing' } },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const out = flowToBundle(makeEmptyBundle(), flow);
  const blankIntent = out.flow.edges.find((e) => e.id === 'e_blank_intent');
  const blankCond = out.flow.edges.find((e) => e.id === 'e_blank_cond');
  const real = out.flow.edges.find((e) => e.id === 'e_real');
  // Stripped data => engine treats these as default/fallback edges, not dead routes.
  assert.strictEqual(blankIntent.data, undefined);
  assert.strictEqual(blankCond.data, undefined);
  assert.deepStrictEqual(real.data, { intent: 'billing' });
});

test('condition object round-trips through bundleToFlow then flowToBundle (re-export stable)', () => {
  const expr = { '==': [{ var: 'intent' }, 'billing'] };
  const bundle = { ...billingBundle(), flow: conditionRoutedGraph('') };
  bundle.flow.edges.find((e) => e.id === 'e_cond').data.condition = expr;
  const flow = bundleToFlow(bundle);
  const out = flowToBundle(bundle, flow);
  assert.deepStrictEqual(out.flow.edges.find((e) => e.id === 'e_cond').data.condition, expr);
});
