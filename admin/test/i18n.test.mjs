import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STRINGS, LOCALES, DEFAULT_LOCALE } from '../src/i18n/strings.js';
import { NODE_KINDS } from '../src/lib/node-kinds.js';
import {
  NODE_CONTENT,
  NODE_KIND_LIST,
  nodeLabel,
  nodeDescription,
  nodeAccent,
  fieldLabel,
  fieldHelp,
} from '../src/i18n/node-content.js';

// English is the default and the fallback. Both invariants are relied on by the
// t() helper, so lock them here.
test('default locale is English and both locales are supported', () => {
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.deepEqual([...LOCALES], ['en', 'ko']);
});

// Every chrome string must exist in BOTH languages so the KO toggle never falls
// back to English unexpectedly (and vice versa).
test('chrome strings have full en<->ko parity', () => {
  const en = Object.keys(STRINGS.en).sort();
  const ko = Object.keys(STRINGS.ko).sort();
  const missingInKo = en.filter((k) => !(k in STRINGS.ko));
  const missingInEn = ko.filter((k) => !(k in STRINGS.en));
  assert.deepEqual(missingInKo, [], `KO is missing keys: ${missingInKo.join(', ')}`);
  assert.deepEqual(missingInEn, [], `EN is missing keys: ${missingInEn.join(', ')}`);
  assert.ok(en.length > 0);
});

test('no chrome string value is blank', () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(STRINGS[locale])) {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim().length > 0, `empty value for ${locale}.${key}`);
    }
  }
});

// Every engine node kind must have plain-language help content in both languages,
// so a first-time user can understand every block.
test('every node kind has bilingual description, ko label, and accent', () => {
  for (const kind of NODE_KIND_LIST) {
    const content = NODE_CONTENT[kind];
    assert.ok(content, `NODE_CONTENT missing kind ${kind}`);
    assert.ok(content.label?.ko?.trim(), `${kind} missing ko label`);
    assert.match(content.accent, /^#[0-9a-fA-F]{6}$/, `${kind} accent not a hex color`);
    assert.ok(nodeDescription(kind, 'en').trim(), `${kind} missing en description`);
    assert.ok(nodeDescription(kind, 'ko').trim(), `${kind} missing ko description`);
  }
});

// Every editable field declared in node-kinds must have bilingual help + labels,
// so no inspector field is left unexplained.
test('every node field has bilingual help and labels', () => {
  for (const kind of NODE_KIND_LIST) {
    for (const field of NODE_KINDS[kind].fields) {
      assert.ok(fieldHelp(kind, field.key, 'en').trim(), `${kind}.${field.key} missing en help`);
      assert.ok(fieldHelp(kind, field.key, 'ko').trim(), `${kind}.${field.key} missing ko help`);
      // English label falls back to the engine-coupled node-kinds label.
      assert.equal(fieldLabel(kind, field, 'en'), field.label);
      assert.ok(fieldLabel(kind, field, 'ko').trim(), `${kind}.${field.key} missing ko label`);
    }
  }
});

// Label resolution: EN comes from node-kinds (single source); KO from the override.
test('nodeLabel uses node-kinds for EN and the override for KO', () => {
  assert.equal(nodeLabel('message', 'en'), NODE_KINDS.message.label);
  assert.equal(nodeLabel('message', 'ko'), NODE_CONTENT.message.label.ko);
  assert.notEqual(nodeLabel('message', 'ko'), nodeLabel('message', 'en'));
});

test('lookups degrade safely for an unknown kind', () => {
  assert.equal(nodeDescription('nope', 'en'), '');
  assert.equal(nodeAccent('nope'), '#9aa5b1');
  assert.equal(fieldHelp('nope', 'x', 'en'), '');
});
