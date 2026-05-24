import { createSafeActionRegistry } from '../actions/safe-actions.js';
import { createLocalRuleEngine } from '../engine/local-rule-engine.js';
import { createNoopSttAdapter } from '../stt/noop-stt-adapter.js';
import { createNoopTtsAdapter } from '../tts/noop-tts-adapter.js';
import { createEventBus } from './events.js';
import { createCallStateMachine } from './state-machine.js';
import { createOverlay } from '../ui/overlay.js';

export function createWebsiteCallCenter(options = {}) {
  const bus = createEventBus();
  const machine = createCallStateMachine((event) => emitState(bus, overlay, event.state));
  const engine = options.engine || createLocalRuleEngine({ scenarios: options.scenarios });
  const stt = options.stt || createNoopSttAdapter();
  const tts = options.tts || createNoopTtsAdapter();
  const actions = options.actionRegistry || createSafeActionRegistry(options.actions);
  const overlay = createOverlay({ mount: options.mount, title: options.title, onEvent, onAction });

  async function prepare() {
    machine.transition('preparing');
    await Promise.all([stt.prepare(reportProgress), tts.prepare(reportProgress), engine.startSession?.()]);
    machine.transition('idle', { reason: 'prepared' });
  }

  async function startVoice() {
    machine.transition('listening');
    await stt.start((event) => bus.emit('transcript', event));
  }

  async function stopVoice() {
    const result = await stt.stop();
    overlay.setTranscript(result.text || '');
    bus.emit('transcript', result);
    if (result.text) await sendText(result.text);
  }

  async function sendText(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    overlay.addMessage('user', clean);
    machine.transition('thinking');
    const response = await engine.sendUserText(clean, { state: machine.getState() });
    await handleAssistant(response);
  }

  async function handleAssistant(response) {
    overlay.addMessage('assistant', response.text);
    overlay.setActions(response.actions || []);
    bus.emit('assistant_message', response);
    machine.transition('speaking');
    await tts.speak(response.text);
    machine.transition('idle', { reason: 'assistant_done' });
  }

  async function endCall() {
    tts.stop?.();
    await engine.endSession?.();
    machine.transition('ended');
  }

  async function onAction(id) {
    const result = await actions.execute(id, { document: overlay.root.ownerDocument, overlay });
    bus.emit('action', { id, status: result.ok ? 'done' : 'rejected', label: result.label, reason: result.reason });
  }

  function onEvent(type, payload) {
    const commands = { prepare, voice: startVoice, stop: stopVoice, sendText: () => sendText(payload.text), end: endCall };
    commands[type]?.().catch((error) => handleError(type, error));
  }

  function handleError(area, error) {
    machine.transition('error', { area });
    bus.emit('error', { area, message: error instanceof Error ? error.message : String(error) });
  }

  function reportProgress(event) {
    overlay.setProgress(event);
    bus.emit('progress', event);
  }

  return { on: bus.on, prepare, startVoice, stopVoice, sendText, endCall, destroy: overlay.destroy, getState: machine.getState };
}

function emitState(bus, overlay, state) {
  overlay?.setState?.(state);
  bus.emit('state', { state });
}
