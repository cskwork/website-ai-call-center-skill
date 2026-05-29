import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { createFlowEngine } from '../src/api.js';
import { createKeywordIntentResolver } from '../src/intent/keyword-resolver.js';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const readJson = (file) => JSON.parse(read(file));

function compileBundleValidator() {
  const scenarioSchema = readJson('schemas/call-scenario.schema.json');
  const bundleSchema = readJson('schemas/config-bundle.schema.json');
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(scenarioSchema);
  return ajv.compile(bundleSchema);
}

function listBundles() {
  const dir = new URL('bundles/', root);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.bundle.json'))
    .sort();
}

// Per-template smoke fixtures: a keyword that classifies one intent and the
// scenario output it must route to, plus an escalation keyword that must reach
// the handoff node. Disclosure-once is asserted generically below.
const SMOKE = {
  'finance.bundle.json': {
    intentKeyword: 'balance',
    expectText: 'where your balance appears',
    escalateKeyword: 'agent',
  },
  'education.bundle.json': {
    intentKeyword: 'enroll',
    expectText: 'enrollment page',
    escalateKeyword: 'advisor',
  },
  'insurance.bundle.json': {
    intentKeyword: 'coverage',
    expectText: 'coverage details are listed',
    escalateKeyword: 'agent',
  },
};

test('every bundle validates against the config-bundle schema (call-scenario added by $id)', () => {
  const validate = compileBundleValidator();
  const bundles = listBundles();
  assert.ok(bundles.length >= 4, `expected at least 4 bundles, found ${bundles.length}`);
  for (const name of bundles) {
    const bundle = readJson(`bundles/${name}`);
    const ok = validate(bundle);
    assert.ok(ok, `${name}: ${JSON.stringify(validate.errors, null, 2)}`);
    assert.equal(bundle.schemaVersion, '2', `${name} schemaVersion`);
  }
});

test('every template wires intent.scenario -> scenario.id and scenario.scenario_intent -> intent.id', () => {
  for (const name of listBundles()) {
    const bundle = readJson(`bundles/${name}`);
    const byId = new Map(bundle.scenarios.map((scenario) => [scenario.id, scenario]));
    for (const intent of bundle.intents) {
      const scenario = byId.get(intent.scenario);
      assert.ok(scenario, `${name}: intent ${intent.id} points at missing scenario ${intent.scenario}`);
      assert.equal(scenario.scenario_intent, intent.id, `${name}: scenario ${scenario.id} back-reference`);
    }
  }
});

for (const [name, fixture] of Object.entries(SMOKE)) {
  test(`${name}: keyword routes to its scenario output and shows the disclosure once`, async () => {
    const bundle = readJson(`bundles/${name}`);
    const engine = createFlowEngine({ bundle });
    await engine.startSession();

    const first = await engine.sendUserText(fixture.intentKeyword);
    assert.ok(
      first.text.includes(fixture.expectText),
      `${name}: expected "${fixture.expectText}" in first reply, got: ${first.text}`,
    );

    const disclosure = bundle.disclosure.text.en;
    const occurrences = first.text.split(disclosure).length - 1;
    assert.equal(occurrences, 1, `${name}: disclosure must appear exactly once on first interaction`);
    assert.equal(first.handoff ?? false, false, `${name}: an information intent must not hand off`);

    // Disclosure is shown only once: a second turn in the same session omits it.
    const second = await engine.sendUserText(fixture.intentKeyword);
    assert.ok(!second.text.includes(disclosure), `${name}: disclosure must not repeat on later turns`);
  });

  test(`${name}: an escalation keyword reaches the handoff node`, async () => {
    const bundle = readJson(`bundles/${name}`);
    const engine = createFlowEngine({ bundle });
    await engine.startSession();
    const reply = await engine.sendUserText(fixture.escalateKeyword);
    assert.equal(reply.handoff, true, `${name}: "${fixture.escalateKeyword}" must reach a handoff`);
  });

  test(`${name}: unrecognized input asks the intent-branch clarification and does not hand off`, async () => {
    const bundle = readJson(`bundles/${name}`);
    const branch = bundle.flow.nodes.find((node) => (node.data?.type ?? node.type) === 'intent-branch');
    const engine = createFlowEngine({ bundle });
    await engine.startSession();
    const reply = await engine.sendUserText('qqzzx gibberish nonsense');
    assert.equal(reply.intent, null, `${name}: gibberish must not classify`);
    assert.equal(reply.handoff ?? false, false, `${name}: unmatched input must not silently escalate`);
    assert.ok(
      reply.text.includes(branch.data.fallback.en),
      `${name}: expected the clarification fallback, got: ${reply.text}`,
    );
  });
}

// Guards the finding that advertised example utterances must classify to their
// OWN intent under the bundle's keyword resolver (EN+KO parity), mirroring the
// engine's buildIntents term union (scenario EN + i18n.ko keywords).
test('every advertised utterance classifies to its own scenario intent (EN+KO parity)', async () => {
  const resolver = createKeywordIntentResolver();
  for (const name of listBundles()) {
    const bundle = readJson(`bundles/${name}`);
    const intents = bundle.scenarios.map((scenario) => ({
      id: scenario.scenario_intent,
      terms: unionKeywords(scenario.match?.keywords, scenario.i18n?.ko?.match?.keywords),
    }));
    for (const scenario of bundle.scenarios) {
      const utterances = [...(scenario.utterances || []), ...(scenario.i18n?.ko?.utterances || [])];
      for (const utterance of utterances) {
        const { intent } = await resolver.classify(utterance, { intents });
        assert.equal(
          intent,
          scenario.scenario_intent,
          `${name}: utterance "${utterance}" classified as ${intent}, expected ${scenario.scenario_intent}`,
        );
      }
    }
  }
});

function unionKeywords(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const term of list || []) {
      const key = String(term || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(term);
    }
  }
  return merged;
}
