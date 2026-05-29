/**
 * Path segments that must never be traversed during var resolution. Reusable by
 * sibling slot-write paths (flow-engine slot-fill) to share one pollution guard.
 * @type {ReadonlySet<string>}
 */
export const FORBIDDEN_KEYS = Object.freeze(new Set(['__proto__', 'prototype', 'constructor']));

const VAR_ROOTS = Object.freeze(new Set(['slot', 'entity', 'intent', 'score']));
const MAX_DEPTH = 64;

/**
 * Eval-free, prototype-pollution-safe JSON condition evaluator. Operators are a
 * sealed allowlist; an unknown operator throws (fail-fast). Var resolution uses
 * own-property lookup only and rejects prototype-related path segments, so it
 * can never traverse or pollute the prototype chain. Pure: never mutates inputs.
 *
 * Semantics: `==`/`!=` are strict (`===`/`!==`, no coercion). Relational
 * (`<`,`<=`,`>`,`>=`) use native JS operators (so `undefined` compares false via
 * NaN, and `null`/string coercion follows JS). `in` uses strict membership and
 * returns false for a non-array list. `defined` is true unless the value is
 * null/undefined/empty-string; `empty` is its negation. `true`/`undefined`/`{}`
 * are the always-true default (unconditional edge); `false`/`null` are false.
 *
 * @param {*} expr Condition expression (literal or one-operator object).
 * @param {{ slots: object, intent: (string|null), score: number, entities: object }} ctx
 * @returns {boolean}
 */
export function evaluateCondition(expr, ctx) {
  return evalExpr(expr, ctx, 0);
}

/**
 * @param {*} expr
 * @param {object} ctx
 * @param {number} depth Recursion depth guard against deeply nested logic.
 * @returns {boolean}
 */
function evalExpr(expr, ctx, depth) {
  if (depth > MAX_DEPTH) throw new Error('Condition nesting exceeds max depth.');
  if (expr === true || expr === undefined) return true;
  if (expr === null || expr === false) return false;
  if (typeof expr !== 'object' || Array.isArray(expr)) return Boolean(expr);

  const keys = Object.keys(expr);
  if (keys.length === 0) return true;
  if (keys.length !== 1) throw new Error('A condition object must have exactly one operator key.');

  const op = keys[0];
  const handler = HANDLERS[op];
  if (!handler) throw new Error(`Unknown condition operator: "${op}"`);
  return handler(expr[op], ctx, depth);
}

/**
 * Resolve a {var: path} or return a raw literal, WITHOUT boolean coercion, so
 * comparisons see real values.
 * @param {*} operand
 * @param {object} ctx
 * @returns {*}
 */
function evalOperand(operand, ctx) {
  if (operand && typeof operand === 'object' && !Array.isArray(operand) && 'var' in operand) {
    return resolveVar(operand.var, ctx);
  }
  return operand;
}

/**
 * Own-property var resolution. Rejects forbidden segments at every level.
 * @param {string} path Dotted path: slot.<name>|entity.<name>|intent|score.
 * @param {object} ctx
 * @returns {*}
 */
function resolveVar(path, ctx) {
  const segments = String(path).split('.');
  const root = segments[0];
  if (!VAR_ROOTS.has(root)) return undefined;
  if (root === 'intent') return ctx.intent;
  if (root === 'score') return ctx.score;
  let value = root === 'slot' ? ctx.slots : ctx.entities;
  for (const segment of segments.slice(1)) {
    if (FORBIDDEN_KEYS.has(segment)) return undefined;
    if (value == null || !Object.hasOwn(value, segment)) return undefined;
    value = value[segment];
  }
  return value;
}

function isDefined(value) {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Sealed operator allowlist. Comparison/in/defined/empty take operands; logical
 * operators recurse into full expressions via evalExpr.
 * @type {Readonly<Record<string, (arg: *, ctx: object, depth: number) => boolean>>}
 */
const HANDLERS = Object.freeze({
  '==': (args, ctx) => evalOperand(args[0], ctx) === evalOperand(args[1], ctx),
  '!=': (args, ctx) => evalOperand(args[0], ctx) !== evalOperand(args[1], ctx),
  '<': (args, ctx) => evalOperand(args[0], ctx) < evalOperand(args[1], ctx),
  '<=': (args, ctx) => evalOperand(args[0], ctx) <= evalOperand(args[1], ctx),
  '>': (args, ctx) => evalOperand(args[0], ctx) > evalOperand(args[1], ctx),
  '>=': (args, ctx) => evalOperand(args[0], ctx) >= evalOperand(args[1], ctx),
  and: (list, ctx, depth) => list.every((item) => evalExpr(item, ctx, depth + 1)),
  or: (list, ctx, depth) => list.some((item) => evalExpr(item, ctx, depth + 1)),
  not: (item, ctx, depth) => !evalExpr(item, ctx, depth + 1),
  in: (args, ctx) => {
    const value = evalOperand(args[0], ctx);
    const list = args[1];
    return Array.isArray(list) && list.includes(value);
  },
  defined: (operand, ctx) => isDefined(evalOperand(operand, ctx)),
  empty: (operand, ctx) => !isDefined(evalOperand(operand, ctx)),
});
