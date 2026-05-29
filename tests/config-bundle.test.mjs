import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

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

function loadYamlScenarios() {
  return ['account', 'audio', 'diagnostics', 'ticket'].map((id) =>
    YAML.parse(read(`scenarios/${id}.yml`)),
  );
}

test('config-bundle schema compiles and the committed bundle validates', () => {
  const validate = compileBundleValidator();
  const bundle = readJson('bundles/support.bundle.json');
  const ok = validate(bundle);
  assert.ok(ok, JSON.stringify(validate.errors, null, 2));
  assert.equal(bundle.schemaVersion, '2');
  assert.equal(bundle.domain, 'support');
});

test('the bundle losslessly preserves every authored scenario and its intent', () => {
  const bundle = readJson('bundles/support.bundle.json');
  const scenarios = loadYamlScenarios();

  assert.equal(bundle.scenarios.length, scenarios.length);
  for (const scenario of scenarios) {
    const carried = bundle.scenarios.find((entry) => entry.id === scenario.id);
    assert.ok(carried, `scenario ${scenario.id} missing from bundle`);
    // Verbatim preservation: the wrapped scenario equals the authored YAML.
    assert.deepEqual(carried, scenario, `scenario ${scenario.id} altered by wrapping`);

    const intent = bundle.intents.find((entry) => entry.id === scenario.scenario_intent);
    assert.ok(intent, `intent ${scenario.scenario_intent} missing from bundle`);
    assert.equal(intent.scenario, scenario.id);
    assert.deepEqual(intent.utterances, scenario.utterances);
  }
});

test('intent ids in the bundle are unique', () => {
  const bundle = readJson('bundles/support.bundle.json');
  const ids = bundle.intents.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('malformed bundles are rejected', () => {
  const validate = compileBundleValidator();
  const base = readJson('bundles/support.bundle.json');

  const missingVersion = structuredClone(base);
  delete missingVersion.schemaVersion;
  assert.equal(validate(missingVersion), false, 'missing schemaVersion should fail');

  const badDomain = structuredClone(base);
  badDomain.domain = 'banking';
  assert.equal(validate(badDomain), false, 'unknown domain should fail');

  const badResolver = structuredClone(base);
  badResolver.intentModel.resolver = 'gpt';
  assert.equal(validate(badResolver), false, 'unknown intent resolver should fail');

  const badSlot = structuredClone(base);
  badSlot.slots = { verified: { type: 'datetime' } };
  assert.equal(validate(badSlot), false, 'unknown slot type should fail');

  const extraField = structuredClone(base);
  extraField.surpriseKey = true;
  assert.equal(validate(extraField), false, 'unknown top-level field should fail');
});

test('the committed bundle is not stale', () => {
  execFileSync(process.execPath, ['scripts/build-bundle.mjs', '--check'], {
    cwd: new URL('../', import.meta.url),
    stdio: 'pipe',
  });
});
