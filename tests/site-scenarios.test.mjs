import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { CALL_SCENARIOS, getScenarioReply, matchCallScenario } from '../site/scenarios.js';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

test('landing scenario catalog has visible management fields', () => {
  assert.equal(CALL_SCENARIOS.length, 4);

  for (const scenario of CALL_SCENARIOS) {
    assert.match(scenario.id, /^[a-z-]+$/);
    assert.ok(scenario.title);
    assert.ok(scenario.summary);
    assert.ok(scenario.phrase);
    assert.ok(scenario.replyText);
    assert.ok(scenario.terms.length >= 3);
    assert.ok(scenario.actions.length >= 1);

    for (const action of scenario.actions) {
      assert.ok(action.id);
      assert.ok(action.label);
    }
  }
});

test('landing scenario catalog drives matching and replies', () => {
  const scenario = matchCallScenario('I cannot hear audio during a support call');
  assert.equal(scenario.id, 'audio');

  const reply = getScenarioReply('I cannot hear audio during a support call');
  assert.equal(reply.scenarioId, 'audio');
  assert.match(reply.text, /audio setup/i);
  assert.deepEqual(reply.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('landing page exposes the scenario catalog instead of hiding it in code', () => {
  assert.match(read('site/index.html'), /id="scenario-catalog"/);
  assert.match(read('site/index.html'), /Call scenario catalog/);
  assert.match(read('site/landing.js'), /from '\.\/scenarios\.js'/);
});
