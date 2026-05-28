import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocale, createUiStrings } from '../src/i18n/resolve-locale.js';
import { UI_STRINGS, DEFAULT_LOCALE } from '../src/i18n/ui-strings.js';

test('resolveLocale normalizes BCP-47-ish tags and trims region', () => {
  assert.equal(resolveLocale('ko-KR'), 'ko');
  assert.equal(resolveLocale('en-US'), 'en');
  assert.equal(resolveLocale('KO'), 'ko');
  assert.equal(resolveLocale('  En  '), 'en');
  assert.equal(resolveLocale('ko_KR'), 'ko');
});

test('resolveLocale falls back safely for unknown or empty input', () => {
  assert.equal(resolveLocale('fr'), DEFAULT_LOCALE);
  assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
  assert.equal(resolveLocale(null), DEFAULT_LOCALE);
  assert.equal(resolveLocale(''), DEFAULT_LOCALE);
  assert.equal(resolveLocale(123), DEFAULT_LOCALE);
  assert.equal(resolveLocale('zh', ['en', 'ko'], 'ko'), 'ko');
});

test('createUiStrings returns the requested locale dictionary', () => {
  const ko = createUiStrings('ko');
  assert.equal(ko.fab, '고객지원');
  assert.equal(ko.status.listening, '듣는 중…');
  const en = createUiStrings('en');
  assert.equal(en.fab, 'Support');
  assert.equal(en.status.idle, 'Ready');
});

test('createUiStrings applies overrides via deep-merge without touching siblings', () => {
  const merged = createUiStrings('ko', { send: 'Go', status: { idle: 'Live' } });
  assert.equal(merged.send, 'Go');
  assert.equal(merged.status.idle, 'Live');
  assert.equal(merged.status.listening, '듣는 중…', 'unspecified status keys keep locale value');
  assert.equal(merged.fab, '고객지원', 'unspecified top-level keys keep locale value');
});

test('createUiStrings falls back to English for a missing locale and is deeply frozen', () => {
  const result = createUiStrings('fr');
  assert.equal(result.fab, UI_STRINGS.en.fab);
  assert.equal(result.status.error, UI_STRINGS.en.status.error);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.status));
  assert.throws(() => { result.status.idle = 'x'; }, TypeError);
});

test('createUiStrings does not mutate the shared UI_STRINGS source', () => {
  createUiStrings('ko', { fab: 'Mutated', status: { idle: 'Mutated' } });
  assert.equal(UI_STRINGS.ko.fab, '고객지원');
  assert.equal(UI_STRINGS.ko.status.idle, '대기 중');
});
