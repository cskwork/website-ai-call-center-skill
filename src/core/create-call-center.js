import { createSafeActionRegistry } from '../actions/safe-actions.js';
import { createLocalRuleEngine } from '../engine/local-rule-engine.js';
import { createNoopSttAdapter } from '../stt/noop-stt-adapter.js';
import { createNoopTtsAdapter } from '../tts/noop-tts-adapter.js';
import { createEventBus } from './events.js';
import { createCallStateMachine } from './state-machine.js';
import { createOverlay } from '../ui/overlay.js';
import { createUiStrings, resolveLocale } from '../i18n/resolve-locale.js';

/** @typedef {import('../i18n/ui-strings.js').UiStrings} UiStrings */

/**
 * Create a website AI call-center: mounts the overlay, wires speech/engine
 * adapters, and exposes a small imperative API. Backward compatible — `locale`
 * and `strings` are optional; with neither, behavior matches English defaults.
 *
 * @param {object} [options]
 * @param {string} [options.title] Localized title; overrides `strings.title`.
 * @param {Element} [options.mount] Host element for the overlay.
 * @param {object} [options.actionRegistry] Pre-built safe-action registry.
 * @param {Record<string, Function>} [options.actions] Action map (if no registry).
 * @param {object} [options.engine] Engine adapter (defaults to local rule engine).
 * @param {object[]} [options.scenarios] Scenarios for the default engine.
 * @param {object} [options.stt] STT adapter (defaults to no-op).
 * @param {object} [options.tts] TTS adapter (defaults to no-op).
 * @param {string} [options.locale] UI locale ('en' default, 'ko' supported).
 * @param {Partial<UiStrings>} [options.strings] Per-string overrides.
 * @returns {{ on: Function, prepare: () => Promise<void>, startVoice: () => Promise<void>,
 *   stopVoice: () => Promise<void>, sendText: (text: string) => Promise<void>,
 *   endCall: () => Promise<void>, destroy: () => void, getState: () => string,
 *   setLocale: (locale: string) => void, setStrings: (overrides: Partial<UiStrings>) => void }}
 */
export function createWebsiteCallCenter(options = {}) {
  let locale = resolveLocale(options.locale);
  let strings = createUiStrings(locale, options.strings);
  let prepared = false;
  const bus = createEventBus();
  const machine = createCallStateMachine((event) => emitState(bus, overlay, event.state));
  const engine = options.engine || createLocalRuleEngine({ scenarios: options.scenarios });
  const stt = options.stt || createNoopSttAdapter();
  const tts = options.tts || createNoopTtsAdapter();
  const actions = options.actionRegistry || createSafeActionRegistry(options.actions);
  const overlay = createOverlay({ mount: options.mount, strings, title: options.title, onEvent, onAction });

  function syncControls() {
    overlay.setControls({ state: machine.getState(), prepared });
  }

  async function prepare() {
    machine.transition('preparing');
    syncControls();
    try {
      await Promise.all([stt.prepare(reportProgress), tts.prepare(reportProgress), engine.startSession?.()]);
      prepared = true;
      machine.transition('idle', { reason: 'prepared' });
    } catch (error) {
      prepared = false;
      throw error;
    } finally {
      syncControls();
    }
  }

  async function startVoice() {
    await stt.start((event) => bus.emit('transcript', event));
    machine.transition('listening');
    syncControls();
  }

  async function stopVoice() {
    const result = (await stt.stop()) || {};
    overlay.setTranscript(result.text || '');
    bus.emit('transcript', result);
    if (result.text) await sendText(result.text);
    else syncControls();
  }

  async function sendText(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    overlay.addMessage('user', clean);
    machine.transition('thinking');
    syncControls();
    const response = await engine.sendUserText(clean, { state: machine.getState() });
    await handleAssistant(response);
  }

  async function handleAssistant(response) {
    const reply = normalizeReply(response);
    overlay.addMessage('assistant', reply.text);
    overlay.setActions(reply.actions);
    bus.emit('assistant_message', reply);
    machine.transition('speaking');
    syncControls();
    await tts.speak(reply.text);
    machine.transition('idle', { reason: 'assistant_done' });
    syncControls();
  }

  async function endCall() {
    tts.stop?.();
    await engine.endSession?.();
    prepared = false;
    machine.transition('ended');
    syncControls();
  }

  async function onAction(id) {
    const doc = overlay.root?.ownerDocument ?? globalThis.document;
    const result = await actions.execute(id, { document: doc, overlay });
    bus.emit('action', { id, status: result.ok ? 'done' : 'rejected', label: result.label, reason: result.reason });
  }

  function onEvent(type, payload) {
    const commands = { prepare, voice: handleVoice, stop: stopSpeaking, sendText: () => sendText(payload.text), end: endCall };
    commands[type]?.().catch((error) => handleError(type, error));
  }

  function handleVoice() {
    if (!prepared) return prepare();
    if (machine.getState() === 'listening') return stopVoice();
    return startVoice();
  }

  async function stopSpeaking() {
    tts.stop?.();
    if (machine.getState() === 'speaking') {
      machine.transition('idle', { reason: 'speaking_stopped' });
      syncControls();
    }
  }

  function handleError(area, error) {
    if (area === 'prepare') prepared = false;
    machine.transition('error', { area });
    syncControls();
    bus.emit('error', { area, message: error instanceof Error ? error.message : String(error) });
  }

  function reportProgress(event) {
    overlay.setProgress(event);
    bus.emit('progress', event);
  }

  /** @param {string} next */
  function setLocale(next) {
    locale = resolveLocale(next);
    strings = createUiStrings(locale, options.strings);
    overlay.setStrings(strings, options.title);
    syncControls();
  }

  /** @param {Partial<UiStrings>} overrides */
  function setStrings(overrides) {
    strings = createUiStrings(locale, overrides);
    overlay.setStrings(strings, options.title);
    syncControls();
  }

  return {
    on: bus.on, prepare, startVoice, stopVoice, sendText, endCall,
    destroy: overlay.destroy, getState: machine.getState, setLocale, setStrings,
  };
}

/**
 * Normalize an engine reply at the boundary so a malformed/empty response
 * cannot throw inside the overlay.
 *
 * @param {{ text?: unknown, actions?: unknown }|null|undefined} response
 * @returns {{ text: string, actions: Array<{ id: string, label?: string }> }}
 */
function normalizeReply(response) {
  return {
    text: String(response?.text ?? ''),
    actions: Array.isArray(response?.actions) ? response.actions : [],
  };
}

/**
 * @param {ReturnType<typeof createEventBus>} bus
 * @param {{ setState?: (state: string) => void }} overlay
 * @param {string} state
 */
function emitState(bus, overlay, state) {
  overlay?.setState?.(state);
  bus.emit('state', { state });
}
