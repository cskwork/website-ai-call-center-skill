import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalRuleEngine, selectScenario } from '../src/engine/local-rule-engine.js';

test('local rule engine chooses the strongest keyword match', async () => {
  const scenarios = [
    { id: 'short', match: ['pay'], response: 'short' },
    { id: 'long', match: ['payment settings'], response: 'long' },
  ];
  assert.equal(selectScenario('Where are payment settings?', scenarios).id, 'long');
  const engine = createLocalRuleEngine({ scenarios });
  await engine.startSession();
  const response = await engine.sendUserText('payment settings');
  assert.equal(response.text, 'long');
});
