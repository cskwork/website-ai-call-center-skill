import assert from 'node:assert/strict';
import test from 'node:test';

import { getPath, setPath } from '../src/lib/nested-data.js';

test('getPath reads nested values and tolerates missing segments', () => {
  const obj = { type: 'message', i18n: { ko: { text: '안녕' } } };
  assert.strictEqual(getPath(obj, 'type'), 'message');
  assert.strictEqual(getPath(obj, 'i18n.ko.text'), '안녕');
  assert.strictEqual(getPath(obj, 'i18n.en.text'), undefined);
  assert.strictEqual(getPath(obj, 'missing.deep.key'), undefined);
});

test('setPath sets nested values immutably', () => {
  const obj = { type: 'message', text: 'hi' };
  const next = setPath(obj, 'i18n.ko.text', '안녕');
  assert.deepStrictEqual(next.i18n, { ko: { text: '안녕' } });
  assert.strictEqual(obj.i18n, undefined); // input untouched
  assert.notStrictEqual(next, obj);
});

test('setPath with empty string prunes the key and empty parents', () => {
  const obj = { type: 'message', text: 'hi', i18n: { ko: { text: '안녕' } } };
  const next = setPath(obj, 'i18n.ko.text', '');
  assert.ok(!('i18n' in next));
  assert.strictEqual(next.text, 'hi');
});
