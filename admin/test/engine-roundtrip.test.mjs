import assert from 'node:assert/strict';
import test from 'node:test';

import { createFlowEngine } from '../../src/api.js';
import { flowToBundle } from '../src/lib/flow-bundle.js';
import { validateBundle } from '../src/lib/validate-bundle.js';
import { makeEmptyBundle } from '../src/lib/empty-bundle.js';

const DISCLOSURE = 'You are chatting with an AI assistant.';

/**
 * A base bundle whose intent/scenario give the intent-branch a winning keyword
 * (threshold 0, keyword resolver) so the matched-path is deterministic.
 */
function billingBundle() {
  return {
    ...makeEmptyBundle(),
    disclosure: { required: true, showOn: 'first-interaction', text: { en: DISCLOSURE } },
    intentModel: { resolver: 'keyword', threshold: 0, model: null },
    intents: [
      { id: 'billing', utterances: ['I need billing help'], scenario: 'billing' },
    ],
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

/** React-Flow-shaped graph WITH runtime fields, to prove the export feeds the engine. */
function authoredReactFlowGraph() {
  return {
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start' }, selected: false, measured: { width: 120, height: 40 } },
      { id: 'n_disc', type: 'ai-disclosure', position: { x: 150, y: 0 }, data: { type: 'ai-disclosure' }, dragging: false },
      { id: 'n_welcome', type: 'message', position: { x: 300, y: 0 }, data: { type: 'message', text: 'Welcome! How can I help?', i18n: { ko: { text: '환영합니다! 무엇을 도와드릴까요?' } } }, width: 160, height: 50 },
      { id: 'n_branch', type: 'intent-branch', position: { x: 450, y: 0 }, data: { type: 'intent-branch', fallback: 'No match. Please rephrase.' }, selected: true },
      { id: 'n_billing', type: 'message', position: { x: 600, y: 0 }, data: { type: 'message', text: 'Here is your billing info.' } },
      { id: 'n_end', type: 'end', position: { x: 750, y: 0 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'n_start', target: 'n_disc', selected: true },
      { id: 'e2', source: 'n_disc', target: 'n_welcome', animated: true },
      { id: 'e3', source: 'n_welcome', target: 'n_branch' },
      { id: 'e4', source: 'n_branch', target: 'n_billing', data: { intent: 'billing' }, style: { stroke: 'green' } },
      { id: 'e5', source: 'n_billing', target: 'n_end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

test('engine round-trip: authored graph (matched intent) drives createFlowEngine', async () => {
  const bundle = flowToBundle(billingBundle(), authoredReactFlowGraph());
  assert.strictEqual(validateBundle(bundle).valid, true, JSON.stringify(validateBundle(bundle).errors));

  const engine = createFlowEngine({ bundle, locale: 'en' });
  await engine.startSession();
  const out = await engine.sendUserText('I need billing help with my invoice');

  assert.strictEqual(out.intent, 'billing');
  assert.strictEqual(out.handoff, false);
  // disclosure node emits the disclosure once, then welcome, then the branched billing message.
  assert.match(out.text, /You are chatting with an AI assistant\./);
  assert.match(out.text, /Welcome! How can I help\?/);
  assert.match(out.text, /Here is your billing info\./);
});

test('engine round-trip: unmatched input takes the branch fallback', async () => {
  const bundle = flowToBundle(billingBundle(), authoredReactFlowGraph());
  const engine = createFlowEngine({ bundle, locale: 'en' });
  await engine.startSession();
  const out = await engine.sendUserText('completely unrelated gibberish zzz');
  assert.strictEqual(out.intent, null);
  assert.match(out.text, /No match\. Please rephrase\./);
});

test('engine round-trip: ko localization uses node.data.i18n.ko.text', async () => {
  const bundle = flowToBundle(billingBundle(), authoredReactFlowGraph());
  const engine = createFlowEngine({ bundle, locale: 'ko' });
  await engine.startSession();
  const out = await engine.sendUserText('billing invoice');
  assert.strictEqual(out.intent, 'billing');
  assert.match(out.text, /환영합니다! 무엇을 도와드릴까요\?/);
});
