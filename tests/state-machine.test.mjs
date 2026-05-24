import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallStateMachine } from '../src/core/state-machine.js';

test('state machine accepts expected call flow and rejects unsafe jumps', () => {
  const seen = [];
  const machine = createCallStateMachine((event) => seen.push(event.state));
  assert.deepEqual(machine.transition('preparing').ok, true);
  assert.deepEqual(machine.transition('idle').ok, true);
  assert.deepEqual(machine.transition('speaking').ok, false);
  assert.equal(machine.getState(), 'idle');
  assert.deepEqual(seen, ['preparing', 'idle']);
});
