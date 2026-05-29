import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbeddingIntentResolver } from '../src/intent/embedding-resolver.js';
import { createFlowEngine } from '../src/engine/flow-engine.js';

// OFFLINE deterministic fake. Builds a normalized bag-of-words vector over a
// fixed vocabulary so cosine argmax is fully predictable and never hits network.
// Words shared between query and an utterance push their cosine toward 1.
const VOCAB = [
  'account', 'profile', 'login', 'settings',
  'sound', 'audio', 'speaker', 'mute',
  'human', 'agent', 'escalate',
  '계정', '설정', '소리', '안',
];

function bagVector(text) {
  const tokens = String(text).toLowerCase().normalize('NFKC').split(/\s+/).filter(Boolean);
  const vec = VOCAB.map((word) => (tokens.includes(word) ? 1 : 0));
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map((value) => value / norm);
}

// Records every text it embedded and the prefix it observed, so tests can assert
// the prefix policy and the prototype-caching call counts.
function makeFakeLoader() {
  const seen = [];
  let loadCount = 0;
  const loadExtractor = async ({ model, dtype, onProgress }) => {
    loadCount += 1;
    onProgress?.({ status: 'ready', model, dtype });
    const extractor = async (text) => {
      seen.push(text);
      return { data: Float32Array.from(bagVector(text)) };
    };
    return extractor;
  };
  return {
    loadExtractor,
    seen,
    get loadCount() { return loadCount; },
    countOf: (text) => seen.filter((entry) => entry === text).length,
  };
}

const INTENTS = [
  { id: 'account_navigation', utterances: ['account profile login', '계정 설정'] },
  { id: 'audio_issue', utterances: ['sound audio speaker', '소리 안'] },
  { id: 'escalation', utterances: ['human agent escalate'] },
];

test('classify returns the keyword-compatible shape and picks the argmax intent', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const res = await resolver.classify('account profile login', { intents: INTENTS });
  assert.equal(res.intent, 'account_navigation');
  assert.ok(res.score > 0 && res.score <= 1, `score in 0..1, got ${res.score}`);
  assert.equal(res.scores.length, INTENTS.length);
  for (const entry of res.scores) {
    assert.equal(typeof entry.intent, 'string');
    assert.equal(typeof entry.score, 'number');
  }
});

test("e5 model applies the 'query: ' prefix; a non-e5 model does not", async () => {
  const e5 = makeFakeLoader();
  const e5Resolver = createEmbeddingIntentResolver({
    model: 'Xenova/multilingual-e5-small', loadExtractor: e5.loadExtractor,
  });
  await e5Resolver.classify('account profile login', { intents: INTENTS });
  assert.ok(e5.seen.some((text) => text === 'query: account profile login'), e5.seen.join(' | '));
  assert.ok(e5.seen.some((text) => text === 'query: account profile login'));
  assert.ok(!e5.seen.includes('account profile login'), 'no unprefixed query for e5');

  const plain = makeFakeLoader();
  const plainResolver = createEmbeddingIntentResolver({
    model: 'Xenova/all-MiniLM-L6-v2', loadExtractor: plain.loadExtractor,
  });
  await plainResolver.classify('account profile login', { intents: INTENTS });
  assert.ok(plain.seen.includes('account profile login'), plain.seen.join(' | '));
  assert.ok(!plain.seen.some((text) => text.startsWith('query: ')), 'no prefix for non-e5');
});

test('prototype vectors are cached: each utterance embeds once across turns, query each turn', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  // Queries are word-subsets of prototypes but distinct strings, so countOf on a
  // prototype string isolates prototype embeds from query embeds.
  await resolver.classify('account profile', { intents: INTENTS });
  await resolver.classify('sound speaker', { intents: INTENTS });
  // Every prototype utterance embedded exactly once total (cached after turn 1).
  for (const intent of INTENTS) {
    for (const utterance of intent.utterances) {
      assert.equal(fake.countOf(utterance), 1, `utterance "${utterance}" embedded once`);
    }
  }
  // Each query embedded once per call (no prefix for fake-model).
  assert.equal(fake.countOf('account profile'), 1);
  assert.equal(fake.countOf('sound speaker'), 1);
});

test('EN+KO union utterances both contribute (a KO query matches a KO prototype)', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const res = await resolver.classify('계정 설정', { intents: INTENTS });
  assert.equal(res.intent, 'account_navigation');
  assert.ok(res.score > 0);
});

test('empty intents -> {intent:null, score:0, scores:[]}', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const res = await resolver.classify('account profile login', { intents: [] });
  assert.deepEqual(res, { intent: null, score: 0, scores: [] });
});

test('an intent with no utterances scores 0', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const intents = [
    { id: 'empty', utterances: [] },
    { id: 'account_navigation', utterances: ['account profile login'] },
  ];
  const res = await resolver.classify('account profile login', { intents });
  const empty = res.scores.find((entry) => entry.intent === 'empty');
  assert.equal(empty.score, 0);
  assert.equal(res.intent, 'account_navigation');
});

test('a query matching no prototype yields intent null (all-non-positive guard)', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const res = await resolver.classify('zzz qqq unrelated', { intents: INTENTS });
  assert.equal(res.intent, null);
  assert.equal(res.score, 0);
});

test('classify does not mutate the passed intents array or its objects', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const intents = [
    { id: 'account_navigation', utterances: ['account profile login'] },
    { id: 'audio_issue', utterances: ['sound audio speaker'] },
  ];
  const snapshot = JSON.parse(JSON.stringify(intents));
  await resolver.classify('account profile login', { intents });
  await resolver.classify('sound audio speaker', { intents });
  assert.deepEqual(intents, snapshot);
  assert.equal(Object.keys(intents[0]).length, 2);
});

test('prepare() is idempotent and loads the extractor once even under a prepare()+classify() race', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  await Promise.all([
    resolver.prepare(),
    resolver.prepare(),
    resolver.classify('account profile login', { intents: INTENTS }),
  ]);
  await resolver.prepare();
  assert.equal(fake.loadCount, 1, 'extractor loaded exactly once');
});

test('prepare(onProgress) forwards progress and resolves', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const events = [];
  await resolver.prepare((event) => events.push(event));
  assert.ok(events.length >= 1, 'progress callback invoked');
});

// --- Flow-engine integration (inject the embedding resolver with a fake) ---

const integrationBundle = {
  schemaVersion: '2',
  intentModel: { resolver: 'embedding', threshold: 0.5 },
  intents: [
    { id: 'account_navigation', utterances: ['account profile login', '계정 설정'], scenario: 'account' },
    { id: 'audio_issue', utterances: ['sound audio speaker'], scenario: 'audio' },
  ],
  scenarios: [
    {
      id: 'account', scenario_intent: 'account_navigation', match: { keywords: ['account'] },
      reply: { text: 'Here is your account path.' }, frontend_actions: [],
    },
    {
      id: 'audio', scenario_intent: 'audio_issue', match: { keywords: ['audio'] },
      reply: { text: 'Audio troubleshooting.' }, frontend_actions: [],
    },
  ],
};

test('flow engine: injected embedding resolver routes a matching query to its scenario', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  const engine = createFlowEngine({ bundle: integrationBundle, intentResolver: resolver, threshold: 0.5 });
  await engine.startSession();
  const res = await engine.sendUserText('account profile login');
  assert.equal(res.scenarioId, 'account');
  assert.equal(res.intent, 'account_navigation');
  assert.ok(res.text.includes('Here is your account path.'), res.text);
});

test('flow engine: a below-threshold embedding score is rejected (fallback, intent null)', async () => {
  const fake = makeFakeLoader();
  const resolver = createEmbeddingIntentResolver({ model: 'fake-model', loadExtractor: fake.loadExtractor });
  // A partial overlap (1 of 3 words) yields cosine < 0.99, below this high threshold.
  const engine = createFlowEngine({ bundle: integrationBundle, intentResolver: resolver, threshold: 0.99 });
  await engine.startSession();
  const res = await engine.sendUserText('account zzz qqq');
  assert.equal(res.scenarioId, null);
  assert.equal(res.intent, null);
  assert.ok(res.text.length > 0);
});
