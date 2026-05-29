import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition } from '../src/engine/condition.js';

const ctx = Object.freeze({
  slots: Object.freeze({ plan: 'pro', flag: false, count: 0, blank: '', nullish: null, name: 'Lee' }),
  intent: 'refund',
  score: 0.82,
  entities: Object.freeze({ orderId: 'A1' }),
});

const nullIntentCtx = Object.freeze({ slots: Object.freeze({}), intent: null, score: 0, entities: Object.freeze({}) });

test('var resolves slot, entity, intent, and score roots', () => {
  assert.equal(evaluateCondition({ '==': [{ var: 'slot.plan' }, 'pro'] }, ctx), true);
  assert.equal(evaluateCondition({ '==': [{ var: 'entity.orderId' }, 'A1'] }, ctx), true);
  assert.equal(evaluateCondition({ '==': [{ var: 'intent' }, 'refund'] }, ctx), true);
  assert.equal(evaluateCondition({ '>=': [{ var: 'score' }, 0.5] }, ctx), true);
});

test('unknown var path resolves to undefined, never throws', () => {
  assert.equal(evaluateCondition({ defined: { var: 'slot.nope' } }, ctx), false);
  assert.equal(evaluateCondition({ defined: { var: 'foo.bar' } }, ctx), false);
});

test('var intent null is not defined', () => {
  assert.equal(evaluateCondition({ defined: { var: 'intent' } }, nullIntentCtx), false);
});

test('equality is strict (no coercion)', () => {
  assert.equal(evaluateCondition({ '==': [1, 1] }, ctx), true);
  assert.equal(evaluateCondition({ '==': [1, '1'] }, ctx), false);
  assert.equal(evaluateCondition({ '==': [{ var: 'slot.nullish' }, 0] }, ctx), false);
  assert.equal(evaluateCondition({ '!=': ['a', 'b'] }, ctx), true);
});

test('relational operators use native JS semantics', () => {
  assert.equal(evaluateCondition({ '<': [1, 2] }, ctx), true);
  assert.equal(evaluateCondition({ '<=': [2, 2] }, ctx), true);
  assert.equal(evaluateCondition({ '>': [3, 2] }, ctx), true);
  assert.equal(evaluateCondition({ '>=': [2, 2] }, ctx), true);
  assert.equal(evaluateCondition({ '<': [{ var: 'slot.missing' }, 5] }, ctx), false);
});

test('logical and/or/not with vacuous truth', () => {
  assert.equal(evaluateCondition({ and: [{ '==': [1, 1] }, { '>': [2, 1] }] }, ctx), true);
  assert.equal(evaluateCondition({ and: [false, { '==': [1, 1] }] }, ctx), false);
  assert.equal(evaluateCondition({ and: [] }, ctx), true);
  assert.equal(evaluateCondition({ or: [{ '==': [1, 2] }, { '==': [2, 2] }] }, ctx), true);
  assert.equal(evaluateCondition({ or: [] }, ctx), false);
  assert.equal(evaluateCondition({ not: { '==': [1, 1] } }, ctx), false);
  assert.equal(evaluateCondition({ not: {} }, ctx), false);
});

test('membership in is strict and graceful', () => {
  assert.equal(evaluateCondition({ in: ['b', ['a', 'b', 'c']] }, ctx), true);
  assert.equal(evaluateCondition({ in: [2, ['1', '2']] }, ctx), false);
  assert.equal(evaluateCondition({ in: [{ var: 'intent' }, ['refund', 'cancel']] }, ctx), true);
  assert.equal(evaluateCondition({ in: ['x', []] }, ctx), false);
  assert.equal(evaluateCondition({ in: ['x', 'not-a-list'] }, ctx), false);
});

test('defined and empty follow null/undefined/empty-string rule', () => {
  assert.equal(evaluateCondition({ defined: { var: 'slot.name' } }, ctx), true);
  assert.equal(evaluateCondition({ defined: { var: 'slot.blank' } }, ctx), false);
  assert.equal(evaluateCondition({ defined: { var: 'slot.nullish' } }, ctx), false);
  assert.equal(evaluateCondition({ defined: { var: 'slot.count' } }, ctx), true);
  assert.equal(evaluateCondition({ defined: { var: 'slot.flag' } }, ctx), true);
  assert.equal(evaluateCondition({ empty: { var: 'slot.nullish' } }, ctx), true);
  assert.equal(evaluateCondition({ empty: { var: 'slot.plan' } }, ctx), false);
});

test('default-true forms: true, undefined, empty object', () => {
  assert.equal(evaluateCondition(true, ctx), true);
  assert.equal(evaluateCondition(undefined, ctx), true);
  assert.equal(evaluateCondition({}, ctx), true);
});

test('literal false and null are not default-true', () => {
  assert.equal(evaluateCondition(false, ctx), false);
  assert.equal(evaluateCondition(null, ctx), false);
});

test('unknown operator throws naming the operator', () => {
  assert.throws(() => evaluateCondition({ regex: ['x', 'y'] }, ctx), /regex/);
});

test('multi-operator-key object throws', () => {
  assert.throws(() => evaluateCondition({ '==': [1, 1], and: [] }, ctx), /one/i);
});

test('prototype-pollution: forbidden segments resolve to undefined', () => {
  assert.equal(evaluateCondition({ defined: { var: 'slot.__proto__' } }, ctx), false);
  assert.equal(evaluateCondition({ defined: { var: 'slot.constructor.prototype' } }, ctx), false);
  assert.equal(evaluateCondition({ defined: { var: 'entity.prototype' } }, ctx), false);
});

test('prototype is not polluted after evaluating malicious expressions', () => {
  const exprs = [
    { '==': [{ var: 'slot.__proto__' }, 'x'] },
    { defined: { var: 'slot.constructor.prototype' } },
    { '==': [{ var: 'entity.__proto__' }, true] },
  ];
  for (const expr of exprs) evaluateCondition(expr, ctx);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  // hasOwnProperty must never resolve as a slot value
  assert.equal(evaluateCondition({ defined: { var: 'slot.hasOwnProperty' } }, ctx), false);
});

test('inputs are not mutated (deep-frozen expr and ctx)', () => {
  const expr = Object.freeze({ and: Object.freeze([Object.freeze({ '==': [1, 1] })]) });
  assert.doesNotThrow(() => evaluateCondition(expr, ctx));
});

test('deeply nested expressions do not crash the host', () => {
  let expr = { '==': [1, 1] };
  for (let i = 0; i < 200; i += 1) expr = { not: expr };
  assert.throws(() => evaluateCondition(expr, ctx), /depth/i);
});
