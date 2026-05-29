import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '../src/api.js';

test('public exports include framework-agnostic call-center primitives', () => {
  for (const name of [
    'createWebsiteCallCenter',
    'createLocalRuleEngine',
    'createFlowEngine',
    'createKeywordIntentResolver',
    'createHttpEngineAdapter',
    'createSafeActionRegistry',
    'createWasmSttAdapter',
    'createPiperTtsAdapter',
    'createNoopSttAdapter',
    'createNoopTtsAdapter',
    'createWorkerAssetUrls',
  ]) {
    assert.equal(typeof sdk[name], 'function', `${name} export`);
  }
});
