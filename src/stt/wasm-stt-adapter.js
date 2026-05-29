import { resolveAssetUrl } from '../core/asset-base.js';
import { blobTo16KhzPcm } from './media-utils.js';

const DEFAULT_MODEL = 'onnx-community/distil-small.en';

/**
 * Create a WASM speech-to-text adapter that runs in a Web Worker. A failed
 * `prepare()` is not cached as a permanent rejection: `ready`/`worker` are
 * cleared so a later call can retry instead of bricking the session.
 *
 * @param {object} [options]
 * @param {typeof Worker} [options.WorkerCtor] Worker constructor.
 * @param {string} [options.dtype] Model quantization dtype.
 * @param {string|null} [options.localModelPath] Local model path.
 * @param {string} [options.modelId] Model id.
 * @param {boolean} [options.useLocalModels] Use local models only.
 * @param {boolean} [options.useOpfsCache] Cache models in OPFS.
 * @param {string|null} [options.workerBaseUrl] Worker base URL.
 * @param {string|null} [options.workerUrl] Explicit worker URL.
 * @returns {{ prepare: (onProgress?: Function) => Promise<void>,
 *   start: (onTranscript?: Function) => Promise<void>,
 *   stop: () => Promise<{ text: string, final: boolean, source: string, durationMs?: number }>,
 *   destroy: () => void }}
 */
export function createWasmSttAdapter({
  WorkerCtor = globalThis.Worker,
  dtype = 'q4',
  localModelPath = null,
  modelId = DEFAULT_MODEL,
  useLocalModels = false,
  useOpfsCache = true,
  workerBaseUrl = null,
  workerUrl = null,
} = {}) {
  let worker = null;
  let ready = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let pending = null;
  let report = () => {};
  let rejectPrepare = null;

  async function prepare(onProgress = report) {
    report = onProgress;
    if (ready) return ready;
    worker = createWorker(WorkerCtor, resolveAssetUrl('workers/stt-worker.js', workerUrl, workerBaseUrl));
    ready = new Promise((resolve, reject) => {
      rejectPrepare = reject; // let destroy() settle an in-flight prepare()
      wireWorker(resolve, reject);
    });
    // On init failure, clear cached state so a later prepare() can retry.
    ready.catch(() => resetWorker());
    worker.postMessage({ type: 'init', dtype, modelId, localModelPath, useLocalModels, useOpfsCache });
    return ready;
  }

  async function start(onTranscript = () => {}) {
    await prepare(report);
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    chunks = [];
    mediaRecorder = createRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    mediaRecorder.start();
    onTranscript({ text: '', final: false, source: 'wasm-stt' });
  }

  async function stop() {
    if (!mediaRecorder) return { text: '', final: true, source: 'wasm-stt' };
    const blob = await stopRecorder(mediaRecorder, chunks);
    stopStream();
    const pcm = await blobTo16KhzPcm(blob);
    const result = await transcribe(pcm);
    return { text: result.text, final: true, source: 'wasm-stt', durationMs: result.durationMs };
  }

  function wireWorker(resolveReady, rejectReady) {
    worker.onmessage = ({ data }) => handleWorkerMessage(data, resolveReady, rejectReady);
    worker.onerror = (event) => rejectReady(new Error(event.message || 'STT worker failed to load.'));
  }

  function handleWorkerMessage(data, resolveReady, rejectReady) {
    if (data.type === 'progress' || data.type === 'cache-backend') report(normalizeProgress(data));
    if (data.type === 'ready') resolveReady();
    if (data.type === 'result') settle(data);
    if (data.type === 'error') reject(data.message, rejectReady);
  }

  function transcribe(pcm) {
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      worker.postMessage({ type: 'transcribe', pcm }, [pcm.buffer]);
    });
  }

  function settle(data) {
    pending?.resolve({ text: data.text, durationMs: data.durationMs });
    pending = null;
  }

  function reject(message, rejectReady) {
    const error = new Error(message);
    rejectReady?.(error);
    pending?.reject(error);
    pending = null;
  }

  function stopStream() {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
  }

  function resetWorker() {
    worker?.terminate?.();
    worker = null;
    ready = null;
  }

  // Release the microphone and terminate the worker. stop() only ends a recording
  // (and leaves the prepared worker resident), so callers that mount/unmount the
  // adapter (e.g. a preview that toggles voice) need this to avoid leaking a live
  // mic stream or an idle worker. Settles any in-flight transcription and is safe
  // to call repeatedly.
  function destroy() {
    stopStream();
    reject('STT adapter destroyed'); // settle any in-flight transcription
    rejectPrepare?.(new Error('STT adapter destroyed')); // settle an in-flight prepare()
    rejectPrepare = null;
    resetWorker();
  }

  return { prepare, start, stop, destroy };
}

function createWorker(WorkerCtor, workerUrl) {
  if (!WorkerCtor) throw new Error('Web Worker is required for WASM STT.');
  return new WorkerCtor(workerUrl, { type: 'module' });
}

function createRecorder(stream) {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is unavailable in this browser.');
  const mimeType = MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

function stopRecorder(recorder, chunks) {
  return new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    recorder.stop();
  });
}

function normalizeProgress(data) {
  if (data.type === 'cache-backend') return { type: 'progress', area: 'stt', phase: 'cache', progress: 5, backend: data.backend };
  const progress = typeof data.progress === 'number' ? Math.round(data.progress) : 0;
  return { type: 'progress', area: 'stt', phase: data.status || 'download', progress, detail: data.file };
}
