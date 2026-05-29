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

const linearGraphBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en', 'ko'] },
  domain: 'custom',
  intentModel: { resolver: 'keyword', threshold: 0 },
  intents: [{ id: 'billing', utterances: ['billing question'], scenario: 's1' }],
  scenarios: [{
    id: 's1', scenario_intent: 'billing', match: { keywords: ['billing', 'invoice'] },
    reply: { text: 'unused-in-graph' }, frontend_actions: [],
  }],
  flow: {
    nodes: [
      { id: 'n_start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'n_msg1', position: { x: 0, y: 1 }, data: { type: 'message', text: 'Welcome.', i18n: { ko: { text: '환영합니다.' } } } },
      { id: 'n_branch', position: { x: 0, y: 2 }, data: { type: 'intent-branch', fallback: 'Did not catch that.' } },
      { id: 'n_msg2', position: { x: 0, y: 3 }, data: { type: 'message', text: 'Here is your billing info.' } },
      { id: 'n_end', position: { x: 0, y: 4 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'n_start', target: 'n_msg1' },
      { id: 'e2', source: 'n_msg1', target: 'n_branch' },
      { id: 'e3', source: 'n_branch', target: 'n_msg2', data: { intent: 'billing' } },
      { id: 'e4', source: 'n_msg2', target: 'n_end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

const slotActionDisclosureBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en'] },
  domain: 'custom',
  disclosure: { required: true, showOn: 'first-interaction', text: { en: 'AI assistant in use.' } },
  intentModel: { resolver: 'keyword', threshold: 0 },
  slots: { account_id: { type: 'text', mappings: [{ type: 'from_entity', entity: 'account_id' }] } },
  intents: [{ id: 'check', utterances: ['check account'], scenario: 's1' }],
  scenarios: [{
    id: 's1', scenario_intent: 'check', match: { keywords: ['check'] }, reply: { text: 'x' }, frontend_actions: [],
  }],
  flow: {
    nodes: [
      { id: 'd', position: { x: 0, y: 0 }, data: { type: 'ai-disclosure' } },
      { id: 'sf', position: { x: 0, y: 1 }, data: { type: 'slot-fill', slot: 'account_id', entity: 'account_id' } },
      { id: 'a', position: { x: 0, y: 2 }, data: { type: 'action', actionId: 'open-billing', label: 'Open billing' } },
      { id: 'm', position: { x: 0, y: 3 }, data: { type: 'message', text: 'Done.' } },
      { id: 'e', position: { x: 0, y: 4 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'x1', source: 'd', target: 'sf' },
      { id: 'x2', source: 'sf', target: 'a' },
      { id: 'x3', source: 'a', target: 'm' },
      { id: 'x4', source: 'm', target: 'e' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

const handoffAndCyclicBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en'] },
  domain: 'custom',
  intentModel: { resolver: 'keyword', threshold: 0 },
  intents: [
    { id: 'human', utterances: ['human agent'], scenario: 's1' },
    { id: 'loop', utterances: ['loop forever'], scenario: 's1' },
  ],
  scenarios: [{
    id: 's1', scenario_intent: 'human', match: { keywords: ['human', 'loop'] }, reply: { text: 'x' }, frontend_actions: [],
  }],
  flow: {
    nodes: [
      { id: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'br', position: { x: 0, y: 1 }, data: { type: 'intent-branch', fallback: '?' } },
      { id: 'ho', position: { x: 0, y: 2 }, data: { type: 'handoff', text: 'Connecting you to an agent.' } },
      { id: 'loopA', position: { x: 0, y: 3 }, data: { type: 'message', text: 'A' } },
      { id: 'loopB', position: { x: 0, y: 4 }, data: { type: 'message', text: 'B' } },
    ],
    edges: [
      { id: 's_br', source: 'start', target: 'br' },
      { id: 'br_ho', source: 'br', target: 'ho', data: { intent: 'human' } },
      { id: 'br_lp', source: 'br', target: 'loopA', data: { intent: 'loop' } },
      { id: 'lp_ab', source: 'loopA', target: 'loopB' },
      { id: 'lp_ba', source: 'loopB', target: 'loopA' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

const chainedBranchBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en'] },
  domain: 'custom',
  intentModel: { resolver: 'keyword', threshold: 0 },
  intents: [
    { id: 'first', utterances: ['first one'], scenario: 's1' },
    { id: 'second', utterances: ['second one'], scenario: 's2' },
  ],
  scenarios: [
    { id: 's1', scenario_intent: 'first', match: { keywords: ['alpha'] }, reply: { text: 'x' }, frontend_actions: [] },
    { id: 's2', scenario_intent: 'second', match: { keywords: ['beta'] }, reply: { text: 'y' }, frontend_actions: [] },
  ],
  flow: {
    nodes: [
      { id: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'br1', position: { x: 0, y: 1 }, data: { type: 'intent-branch', fallback: 'fb1' } },
      { id: 'mid', position: { x: 0, y: 2 }, data: { type: 'message', text: 'MID' } },
      { id: 'br2', position: { x: 0, y: 3 }, data: { type: 'intent-branch', fallback: 'fb2' } },
      { id: 'done', position: { x: 0, y: 4 }, data: { type: 'message', text: 'DONE' } },
      { id: 'end', position: { x: 0, y: 5 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 's_br1', source: 'start', target: 'br1' },
      { id: 'br1_mid', source: 'br1', target: 'mid', data: { intent: 'first' } },
      { id: 'mid_br2', source: 'mid', target: 'br2' },
      { id: 'br2_done', source: 'br2', target: 'done', data: { intent: 'second' } },
      { id: 'done_end', source: 'done', target: 'end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

test('graph mode: two intent-branches in series only consume one intent per turn', async () => {
  const engine = createFlowEngine({ bundle: chainedBranchBundle });
  await engine.startSession();
  // Turn 1: 'first' picks br1 -> MID -> reaches br2 (input node) and waits.
  const turn1 = await engine.sendUserText('alpha first one');
  assert.ok(turn1.text.includes('MID'), turn1.text);
  assert.ok(!turn1.text.includes('fb2'), turn1.text);
  assert.ok(!turn1.text.includes('DONE'), turn1.text);
  // Turn 2: 'second' advances past br2 -> DONE -> end.
  const turn2 = await engine.sendUserText('beta second one');
  assert.ok(turn2.text.includes('DONE'), turn2.text);
  assert.ok(!turn2.text.includes('fb2'), turn2.text);
});

const scopedSlotFillBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en'] },
  domain: 'custom',
  intentModel: { resolver: 'keyword', threshold: 0 },
  slots: {
    topic: { type: 'text' },
    plan: { type: 'text', mappings: [{ type: 'from_intent', intent: ['upgrade'], value: 'pro' }] },
  },
  intents: [{ id: 'upgrade', utterances: ['upgrade plan'], scenario: 's1' }],
  scenarios: [{
    id: 's1', scenario_intent: 'upgrade', match: { keywords: ['upgrade'] }, reply: { text: 'x' }, frontend_actions: [],
  }],
  flow: {
    nodes: [
      { id: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'sf', position: { x: 0, y: 1 }, data: { type: 'slot-fill', slot: 'topic' } },
      { id: 'm', position: { x: 0, y: 2 }, data: { type: 'message', text: 'ok' } },
      { id: 'end', position: { x: 0, y: 3 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 's_sf', source: 'start', target: 'sf' },
      { id: 'sf_m', source: 'sf', target: 'm' },
      { id: 'm_end', source: 'm', target: 'end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

test('graph mode: slot-fill intent fallback is scoped to node.data.slot only', async () => {
  const engine = createFlowEngine({ bundle: scopedSlotFillBundle });
  await engine.startSession();
  const res = await engine.sendUserText('upgrade');
  // topic has no from_intent mapping -> stays null; plan is NOT a side effect.
  assert.equal(res.slots.topic, null);
  assert.equal(res.slots.plan, null);
});

test('graph mode: a new turn after reaching end re-enters at start (not blank)', async () => {
  const engine = createFlowEngine({ bundle: linearGraphBundle });
  await engine.startSession();
  const first = await engine.sendUserText('billing invoice problem');
  assert.ok(first.text.includes('Here is your billing info.'), first.text);
  // The first turn reached n-end; a later turn in the same session must re-route,
  // not return a blank reply (regression for terminal-node session stall).
  const second = await engine.sendUserText('billing invoice');
  assert.ok(second.text.includes('Here is your billing info.'), `expected re-route, got: ${JSON.stringify(second.text)}`);
});

test('graph mode: happy path start->message->intent-branch->message', async () => {
  const engine = createFlowEngine({ bundle: linearGraphBundle });
  await engine.startSession();
  const res = await engine.sendUserText('billing invoice problem');
  assert.equal(res.intent, 'billing');
  assert.ok(res.text.includes('Welcome.'), res.text);
  assert.ok(res.text.includes('Here is your billing info.'), res.text);
  assert.ok(!res.handoff);
});

test('graph mode: message i18n picks ko text', async () => {
  const engine = createFlowEngine({ bundle: linearGraphBundle, locale: 'ko' });
  await engine.startSession();
  const res = await engine.sendUserText('billing');
  assert.ok(res.text.includes('환영합니다.'), res.text);
  assert.ok(!res.text.includes('Welcome.'), res.text);
});

test('graph mode: intent-branch unmatched stays and emits fallback', async () => {
  const engine = createFlowEngine({ bundle: linearGraphBundle });
  await engine.startSession();
  const miss = await engine.sendUserText('totally unrelated zzz');
  assert.ok(miss.text.includes('Did not catch that.'), miss.text);
  const hit = await engine.sendUserText('billing invoice');
  assert.ok(hit.text.includes('Here is your billing info.'), hit.text);
});

test('graph mode: from_entity fills slot and does not mutate caller entities', async () => {
  const engine = createFlowEngine({ bundle: slotActionDisclosureBundle });
  await engine.startSession();
  const entities = { account_id: 'A-42' };
  const res = await engine.sendUserText('check', { entities });
  assert.equal(res.slots.account_id, 'A-42');
  assert.deepEqual(entities, { account_id: 'A-42' });
});

test('graph mode: action node yields action id without executing', async () => {
  const engine = createFlowEngine({ bundle: slotActionDisclosureBundle });
  await engine.startSession();
  const res = await engine.sendUserText('check', { entities: { account_id: 'A-42' } });
  assert.deepEqual(res.actions, [{ id: 'open-billing', label: 'Open billing' }]);
});

test('graph mode: ai-disclosure node prepends once', async () => {
  const engine = createFlowEngine({ bundle: slotActionDisclosureBundle });
  await engine.startSession();
  const first = await engine.sendUserText('check', { entities: { account_id: 'A-42' } });
  assert.ok(first.text.startsWith('AI assistant in use.'), first.text);
  const second = await engine.sendUserText('check', { entities: { account_id: 'A-42' } });
  assert.ok(!second.text.startsWith('AI assistant in use.'), second.text);
});

test('graph mode: missing context.entities is safe', async () => {
  const engine = createFlowEngine({ bundle: slotActionDisclosureBundle });
  await engine.startSession();
  const res = await engine.sendUserText('check');
  assert.equal(res.slots.account_id, null);
  assert.ok(typeof res.text === 'string');
});

test('graph mode: handoff node sets handoff true and stops', async () => {
  const engine = createFlowEngine({ bundle: handoffAndCyclicBundle });
  await engine.startSession();
  const res = await engine.sendUserText('I want a human agent');
  assert.equal(res.handoff, true);
  assert.ok(res.text.includes('Connecting you to an agent.'), res.text);
});

test('graph mode: loop guard returns without hanging on cyclic flow', async () => {
  const engine = createFlowEngine({ bundle: handoffAndCyclicBundle });
  await engine.startSession();
  const res = await engine.sendUserText('loop forever');
  assert.ok(typeof res.text === 'string');
  assert.ok(Array.isArray(res.actions));
});

const configDisclosureGraphBundle = {
  schemaVersion: '2',
  tenant: { id: 't', name: 'T', locales: ['en'] },
  domain: 'custom',
  disclosure: { required: true, showOn: 'first-interaction', text: { en: 'AI in use.' } },
  intentModel: { resolver: 'keyword', threshold: 0 },
  intents: [{ id: 'hi', utterances: ['hello'], scenario: 's1' }],
  scenarios: [{ id: 's1', scenario_intent: 'hi', match: { keywords: ['hello'] }, reply: { text: 'x' }, frontend_actions: [] }],
  flow: {
    nodes: [
      { id: 'start', position: { x: 0, y: 0 }, data: { type: 'start' } },
      { id: 'm', position: { x: 0, y: 1 }, data: { type: 'message', text: 'Hi there.' } },
      { id: 'end', position: { x: 0, y: 2 }, data: { type: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'm' },
      { id: 'e2', source: 'm', target: 'end' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

test('graph mode: config disclosure prefix uses two-newline spacing like legacy', async () => {
  const engine = createFlowEngine({ bundle: configDisclosureGraphBundle });
  await engine.startSession();
  const res = await engine.sendUserText('hello');
  assert.ok(res.text.startsWith('AI in use.\n\nHi there.'), JSON.stringify(res.text));
  assert.ok(!/\n{3,}/.test(res.text), `no 3+ consecutive newlines: ${JSON.stringify(res.text)}`);
});

test('from_entity is a no-op without mappings/entities (legacy preserved)', async () => {
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
  await engine.startSession();
  const res = await engine.sendUserText('please upgrade my plan');
  assert.equal(res.slots.verified, false);
  assert.equal(res.slots.plan, 'pro');
});
