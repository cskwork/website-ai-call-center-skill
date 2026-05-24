import { env, pipeline } from '@huggingface/transformers';

let transcriber = null;
let loading = null;

self.onmessage = async (event) => {
  try {
    if (event.data.type === 'init') {
      await loadModel(event.data);
      postMessage({ type: 'ready' });
      return;
    }
    if (event.data.type === 'transcribe') await transcribe(event.data.pcm);
  } catch (error) {
    postMessage({ type: 'error', message: errorMessage(error) });
  }
};

async function loadModel(options) {
  if (transcriber) return;
  if (loading) return loading;
  loading = loadPipeline(options);
  return loading;
}

async function loadPipeline({ dtype = 'q4', modelId, localModelPath, useLocalModels, useOpfsCache }) {
  env.allowLocalModels = useLocalModels === true;
  env.allowRemoteModels = useLocalModels !== true;
  if (useLocalModels && localModelPath) env.localModelPath = localModelPath;
  const backend = await wireCacheBackend(useOpfsCache === true);
  postMessage({ type: 'cache-backend', backend });
  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    device: 'wasm',
    dtype,
    local_files_only: useLocalModels === true,
    progress_callback: (progress) => postMessage(progressMessage(progress)),
  });
}

async function transcribe(pcm) {
  if (!transcriber) throw new Error('STT model is not initialized.');
  const started = performance.now();
  const output = await transcriber(pcm, {
    chunk_length_s: 15,
    do_sample: false,
    num_beams: 1,
    stride_length_s: 2,
    temperature: 0,
  });
  postMessage({ type: 'result', text: output.text.trim(), durationMs: performance.now() - started });
}

async function wireCacheBackend(useOpfsCache) {
  if (!useOpfsCache) return defaultBackend();
  try {
    const mod = await import('../storage/opfs-cache.js');
    const cache = mod.createOpfsCache();
    if (await cache.isAvailable()) {
      env.useCustomCache = true;
      env.customCache = cache;
      return 'opfs';
    }
  } catch {}
  return defaultBackend();
}

function defaultBackend() {
  return typeof caches !== 'undefined' ? 'cache-api' : 'memory-only';
}

function progressMessage(progress) {
  if (typeof progress !== 'object' || progress === null) return { type: 'progress', progress };
  const { file, progress: percent, status, loaded, total } = progress;
  return { type: 'progress', area: 'stt', file, progress: percent, status, loaded, total };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
