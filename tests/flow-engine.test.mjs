import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFlowEngine } from '../src/engine/flow-engine.js';
import { createKeywordIntentResolver } from '../src/intent/keyword-resolver.js';

const bundle = JSON.parse(fs.readFileSync(new URL('../bundles/support.bundle.json', import.meta.url), 'utf8'));

test('keyword resolver scores against terms and picks the best, or null on no match', async () => {
  const resolver = createKeywordIntentResolver();
  const intents = [
    { id: 'account_navigation', terms: ['account', 'profile'] },
    { id: 'audio_issue', terms: ['audio', 'sound'] },
  ];
  const hit = await resolver.classify('where is my account profile', { intents });
  assert.equal(hit.intent, 'account_navigation');
  assert.ok(hit.score > 0);

  const miss = await resolver.classify('totally unrelated zzz', { intents });
  assert.equal(miss.intent, null);
  assert.equal(miss.score, 0);
});

test('flow engine exposes the engine adapter contract', () => {
  const engine = createFlowEngine({ bundle });
  for (const method of ['prepare', 'startSession', 'sendUserText', 'endSession']) {
    assert.equal(typeof engine[method], 'function', method);
  }
});

test('flow engine requires a bundle with scenarios', () => {
  assert.throws(() => createFlowEngine({}), /config bundle/);
});

test('flow engine resolves intent to the scenario reply and actions (EN)', async () => {
  const engine = createFlowEngine({ bundle });
  await engine.startSession();
  const res = await engine.sendUserText('I cannot find account settings');
  assert.equal(res.scenarioId, 'account');
  assert.equal(res.intent, 'account_navigation');
  assert.ok(res.text.includes('account path'));
  assert.deepEqual(res.actions, [{ id: 'show-account', label: 'Show account path' }]);
});

test('flow engine localizes reply and action labels for ko', async () => {
  const engine = createFlowEngine({ bundle, locale: 'ko' });
  await engine.startSession();
  const res = await engine.sendUserText('계정 설정을 못 찾겠어요');
  assert.equal(res.scenarioId, 'account');
  assert.ok(res.text.includes('계정 경로'));
  assert.deepEqual(res.actions, [{ id: 'show-account', label: '계정 경로 보기' }]);
});

test('AI disclosure is prepended once on first interaction', async () => {
  const engine = createFlowEngine({ bundle });
  await engine.startSession();
  const first = await engine.sendUserText('I cannot find account settings');
  assert.ok(first.text.startsWith('You are chatting with an AI assistant.'), first.text);
  const second = await engine.sendUserText('I cannot find account settings');
  assert.ok(!second.text.startsWith('You are chatting with an AI assistant.'), second.text);
});

test('unmatched input returns a fallback with no scenario', async () => {
  const engine = createFlowEngine({ bundle });
  await engine.startSession();
  const res = await engine.sendUserText('zzz nonsense qwerty');
  assert.equal(res.scenarioId, null);
  assert.equal(res.intent, null);
  assert.ok(res.text.length > 0);
});

test('a high threshold rejects weak matches and falls back', async () => {
  const engine = createFlowEngine({ bundle, threshold: 1000 });
  await engine.startSession();
  const res = await engine.sendUserText('I cannot find account settings');
  assert.equal(res.scenarioId, null);
});

test('slots initialize from defaults and fill from intent mappings', async () => {
  const crafted = {
    schemaVersion: '2',
    intentModel: { resolver: 'keyword', threshold: 0 },
    slots: {
      verified: { type: 'bool', initial_value: false },
      plan: { type: 'text', mappings: [{ type: 'from_intent', intent: ['upgrade'], value: 'pro' }] },
    },
    intents: [{ id: 'upgrade', utterances: ['upgrade my plan'], scenario: 'up' }],
    scenarios: [{
      id: 'up', scenario_intent: 'upgrade', match: { keywords: ['upgrade'] },
      reply: { text: 'Upgraded.' }, frontend_actions: [], workflow: { issue_type: 'sales' },
    }],
  };
  const engine = createFlowEngine({ bundle: crafted });
  const started = await engine.startSession();
  assert.ok(started.sessionId);
  const res = await engine.sendUserText('please upgrade my plan');
  assert.equal(res.intent, 'upgrade');
  assert.equal(res.slots.verified, false);
  assert.equal(res.slots.plan, 'pro');
});

test('handoff flag reflects the matched scenario workflow', async () => {
  const crafted = {
    schemaVersion: '2',
    intentModel: { resolver: 'keyword', threshold: 0 },
    intents: [{ id: 'agent', utterances: ['agent'], scenario: 'esc' }],
    scenarios: [{
      id: 'esc', scenario_intent: 'agent', match: { keywords: ['agent', 'human'] },
      reply: { text: 'Connecting you.' }, frontend_actions: [], workflow: { issue_type: 'handoff', handoff: true },
    }],
  };
  const engine = createFlowEngine({ bundle: crafted });
  await engine.startSession();
  const res = await engine.sendUserText('I want a human agent');
  assert.equal(res.intent, 'agent');
  assert.equal(res.handoff, true);
});

test('a custom intent resolver can be injected (drop-in seam)', async () => {
  const stub = {
    prepare: async () => {},
    classify: async () => ({ intent: 'audio_issue', score: 0.9, scores: [] }),
  };
  const engine = createFlowEngine({ bundle, intentResolver: stub });
  await engine.startSession();
  const res = await engine.sendUserText('anything at all');
  assert.equal(res.scenarioId, 'audio');
});
