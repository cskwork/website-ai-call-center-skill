import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

// Generates an example domain config bundle (v2) from the authored scenarios in
// scenarios/*.yml. This proves the v2 schema can hold the existing scenarios
// losslessly. The committed bundle is a generated artifact: `--check` guards it
// against drift, mirroring scripts/build-scenarios.mjs.

const root = path.resolve(new URL('..', import.meta.url).pathname);
const scenariosDir = path.join(root, 'scenarios');
const scenarioSchemaPath = path.join(root, 'schemas/call-scenario.schema.json');
const bundleSchemaPath = path.join(root, 'schemas/config-bundle.schema.json');
const outputPath = path.join(root, 'bundles/support.bundle.json');
const checkOnly = process.argv.includes('--check');

const scenarioSchema = JSON.parse(await fs.readFile(scenarioSchemaPath, 'utf8'));
const bundleSchema = JSON.parse(await fs.readFile(bundleSchemaPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(scenarioSchema);
const validateScenario = ajv.getSchema(scenarioSchema.$id);
const validateBundle = ajv.compile(bundleSchema);

const scenarios = await loadScenarios();
const bundle = assembleBundle(scenarios);
assertValid('config bundle', validateBundle, bundle);
const output = `${JSON.stringify(bundle, null, 2)}\n`;

if (checkOnly) {
  const current = await fs.readFile(outputPath, 'utf8').catch(() => '');
  if (current !== output) {
    throw new Error('bundles/support.bundle.json is stale. Run npm run bundle:build.');
  }
  console.log('build-bundle: ok');
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`build-bundle: wrote ${path.relative(root, outputPath)}`);
}

async function loadScenarios() {
  const files = (await fs.readdir(scenariosDir))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort();
  if (!files.length) throw new Error('No scenario YAML files found.');

  const entries = [];
  for (const file of files) {
    const parsed = YAML.parse(await fs.readFile(path.join(scenariosDir, file), 'utf8'));
    assertValid(file, validateScenario, parsed);
    entries.push(parsed);
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Wrap the authored scenarios into a single domain bundle. The mapping is
 * lossless: every scenario is preserved verbatim under `scenarios`, and its
 * intent is surfaced under `intents` for the intent resolver.
 *
 * @param {object[]} scenarios Parsed, schema-valid scenario objects.
 * @returns {object} A config bundle that validates against config-bundle.schema.json.
 */
function assembleBundle(scenarios) {
  return {
    schemaVersion: '2',
    tenant: { id: 'demo', name: 'Demo Support', locales: ['en', 'ko'] },
    domain: 'support',
    governance: {
      owner: 'owner@example.com',
      modelVersions: { intent: 'keyword', llm: null },
      lastReviewed: '2026-05-29',
      notes: 'Example bundle generated from scenarios/*.yml by scripts/build-bundle.mjs.',
    },
    disclosure: {
      required: true,
      showOn: 'first-interaction',
      text: {
        en: 'You are chatting with an AI assistant.',
        ko: 'AI 도우미와 대화 중입니다.',
      },
    },
    intentModel: { resolver: 'keyword', threshold: 0, model: null },
    intents: scenarios.map((scenario) => ({
      id: scenario.scenario_intent,
      utterances: scenario.utterances,
      scenario: scenario.id,
    })),
    scenarios,
    flow: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

function assertValid(label, validate, value) {
  if (!validate(value)) {
    const details = (validate.errors || [])
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}
