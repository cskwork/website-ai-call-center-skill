import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { CALL_SCENARIOS, getScenarioReply, getScenarioReplyForIntent, matchCallScenario } from '../site/scenarios.js';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

test('landing scenario catalog has visible management fields', () => {
  assert.equal(CALL_SCENARIOS.length, 4);
  assert.equal(CALL_SCENARIOS[0].id, 'audio');

  for (const scenario of CALL_SCENARIOS) {
    assert.match(scenario.id, /^[a-z-]+$/);
    assert.ok(scenario.title);
    assert.ok(scenario.scenario_intent);
    assert.ok(scenario.summary);
    assert.ok(scenario.phrase);
    assert.ok(scenario.replyText);
    assert.ok(scenario.workflow.issue_type);
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
  assert.equal(reply.scenario_intent, 'audio_issue');
  assert.equal(reply.workflow.issue_type, 'technical_support');
  assert.match(reply.text, /audio setup/i);
  assert.deepEqual(reply.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('landing scenario catalog can be resolved by detected intent', () => {
  const reply = getScenarioReplyForIntent('audio_issue');
  assert.equal(reply.scenarioId, 'audio');
  assert.equal(reply.scenario_intent, 'audio_issue');
  assert.deepEqual(reply.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('landing page exposes the scenario catalog instead of hiding it in code', () => {
  assert.match(read('site/index.html'), /id="scenario-catalog"/);
  assert.match(read('site/index.html'), /Call scenario catalog/);
  assert.match(read('site/landing.js'), /from '\.\/scenarios\.js'/);
});

test('scenario action ids are registered by the landing page', () => {
  const registered = new Set(
    [...read('site/landing.js').matchAll(/register\(\{\s*id: '([^']+)'/g)].map((match) => match[1]),
  );
  const scenarioActionIds = CALL_SCENARIOS.flatMap((scenario) => scenario.actions.map((action) => action.id));

  for (const actionId of scenarioActionIds) {
    assert.ok(registered.has(actionId), `${actionId} must be registered in site/landing.js`);
  }
});
