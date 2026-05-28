import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsForState } from '../src/ui/overlay.js';
import { createUiStrings } from '../src/i18n/resolve-locale.js';

const strings = createUiStrings('en');

test('idle + not prepared shows the prepare-mode voice button and send only', () => {
  const controls = controlsForState('idle', false, strings);
  assert.equal(controls.voice.show, true);
  assert.equal(controls.voice.mode, 'prepare');
  assert.equal(controls.voice.label, strings.prepare);
  assert.equal(controls.voice.icon, 'mic-off');
  assert.equal(controls.send.show, true);
  assert.equal(controls.stopSpeaking.show, false);
  assert.equal(controls.end.show, false, 'no session yet, no End button');
});

test('idle + prepared shows start-mode voice, send, and end', () => {
  const controls = controlsForState('idle', true, strings);
  assert.equal(controls.voice.mode, 'start');
  assert.equal(controls.voice.label, strings.voiceStart);
  assert.equal(controls.voice.icon, 'mic');
  assert.equal(controls.send.show, true);
  assert.equal(controls.stopSpeaking.show, false);
  assert.equal(controls.end.show, true, 'prepared session shows End');
});

test('listening + prepared morphs the voice button into stop-listening', () => {
  const controls = controlsForState('listening', true, strings);
  assert.equal(controls.voice.mode, 'stop');
  assert.equal(controls.voice.label, strings.voiceStop);
  assert.equal(controls.voice.icon, 'stop');
  assert.equal(controls.stopSpeaking.show, false, 'stopSpeaking is TTS-only, not listening');
  assert.equal(controls.end.show, true);
});

test('speaking shows the stop-speaking (TTS) button and keeps end visible', () => {
  const controls = controlsForState('speaking', true, strings);
  assert.equal(controls.stopSpeaking.show, true);
  assert.equal(controls.send.show, true);
  assert.equal(controls.end.show, true);
});

test('end is visible during an active session even before prepared resolves', () => {
  for (const state of ['preparing', 'listening', 'thinking', 'speaking']) {
    assert.equal(controlsForState(state, false, strings).end.show, true, `${state} keeps End`);
  }
  assert.equal(controlsForState('ended', false, strings).end.show, false);
});
