import { resolveAssetUrl } from '../core/asset-base.js';
import { createNoopTtsAdapter } from './noop-tts-adapter.js';

/** @typedef {{ type: string, area?: string, phase?: string, progress?: number, detail?: string, backend?: string }} ProgressEvent */
/** @typedef {{ pcm: Float32Array, sampleRate: number }} PcmAudio */
/** @typedef {(event: ProgressEvent) => void} ProgressReporter */

const DEFAULT_WASM_PATHS = Object.freeze({
  onnxWasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
  piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
});

export function createPiperTtsAdapter({
  WorkerCtor = globalThis.Worker,
  fallback = createNoopTtsAdapter(),
  modelId = 'en_US-hfc_female-medium',
  voice = modelId,
  dtype = 'fp32',
  preferOpfsCache = true,
  useOpfsCache = preferOpfsCache,
  wasmPaths = DEFAULT_WASM_PATHS,
  workerBaseUrl = null,
  workerUrl = null,
} = {}) {
  let worker = null;
  let ready = null;
  /** @type {ProgressReporter} */
  let report = () => {};
  let degraded = false;
  let nextId = 1;
  const pending = new Map();

  async function prepare(onProgress = report) {
    report = onProgress;
    if (ready) return ready;
    try {
      worker = createWorker(WorkerCtor, resolveAssetUrl('workers/tts-worker.js', workerUrl, workerBaseUrl));
      ready = new Promise((resolve, reject) => wireWorker(resolve, reject));
      worker.postMessage({ type: 'init', modelId, voice, dtype, useOpfsCache, wasmPaths });
      await ready;
      degraded = false;
      return;
    } catch (error) {
      markDegraded(error);
      await fallback?.prepare?.(onProgress);
    }
  }

  async function speak(text) {
    await prepare(report);
    if (degraded) {
      await fallback?.speak?.(text);
      return;
    }
    try {
      const audio = await requestAudio(text);
      await playPcm(audio.pcm, audio.sampleRate);
    } catch (error) {
      markDegraded(error);
      await fallback?.speak?.(text);
    }
  }

  function stop() {
    worker?.terminate?.();
    worker = null;
    ready = null;
    fallback?.stop?.();
  }

  function wireWorker(resolveReady, rejectReady) {
    worker.onmessage = ({ data }) => handleWorkerMessage(data, resolveReady, rejectReady);
    worker.onerror = (event) => rejectReady(new Error(event.message || 'TTS worker failed to load.'));
  }

  function handleWorkerMessage(data, resolveReady, rejectReady) {
    if (data.type === 'progress' || data.type === 'cache-backend') report(normalizeProgress(data));
    if (data.type === 'ready') resolveReady();
    if (data.type === 'audio') settleAudio(data);
    if (data.type === 'error') rejectAudio(data, rejectReady);
  }

  /** @returns {Promise<PcmAudio>} */
  function requestAudio(text) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ type: 'speak', id, text });
    });
  }

  function settleAudio(data) {
    const entry = pending.get(data.id);
    pending.delete(data.id);
    entry?.resolve({ pcm: data.pcm, sampleRate: data.sampleRate });
  }

  function rejectAudio(data, rejectReady) {
    const error = new Error(data.message);
    if (data.id != null && pending.has(data.id)) pending.get(data.id).reject(error);
    else rejectReady?.(error);
  }

  function markDegraded(error) {
    degraded = true;
    ready = null;
    worker?.terminate?.();
    worker = null;
    report(fallbackEvent(error));
  }

  return { prepare, speak, stop };
}

function createWorker(WorkerCtor, workerUrl) {
  if (!WorkerCtor) throw new Error('Web Worker is required for Piper TTS.');
  return new WorkerCtor(workerUrl, { type: 'module' });
}

async function playPcm(pcm, sampleRate) {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('AudioContext is not available.');
  const context = new AudioContextCtor({ sampleRate });
  const buffer = context.createBuffer(1, pcm.length, sampleRate);
  buffer.copyToChannel(pcm, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  await new Promise((resolve) => { source.onended = resolve; });
  await context.close?.();
}

function normalizeProgress(data) {
  if (data.type === 'cache-backend') return { type: 'progress', area: 'tts', phase: 'cache', progress: 5, backend: data.backend };
  const progress = typeof data.progress === 'number' ? Math.round(data.progress) : 0;
  return { type: 'progress', area: 'tts', phase: data.status || 'download', progress, detail: data.file };
}

function fallbackEvent(error) {
  const detail = error instanceof Error ? error.message : String(error);
  return { type: 'progress', area: 'tts', phase: 'fallback', progress: 100, detail: `Piper unavailable; using fallback TTS. ${detail}` };
}
