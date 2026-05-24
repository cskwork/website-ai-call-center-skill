import { TtsSession } from '@mintplex-labs/piper-tts-web';

let tts = null;
let loading = null;
let activeVoice = 'en_US-hfc_female-medium';

self.onmessage = async (event) => {
  try {
    if (event.data.type === 'init') {
      await loadModel(event.data);
      postMessage({ type: 'ready' });
      return;
    }
    if (event.data.type === 'speak') await speak(event.data);
  } catch (error) {
    postMessage({ type: 'error', id: event.data?.id ?? null, message: errorMessage(error) });
  }
};

async function loadModel({ modelId, voice, wasmPaths, useOpfsCache = true }) {
  if (tts) return;
  if (loading) return loading;
  activeVoice = voice || modelId || activeVoice;
  loading = TtsSession.create({
    voiceId: activeVoice,
    progress: (progress) => postMessage(progressMessage(progress)),
    ...(wasmPaths ? { wasmPaths } : {}),
  }).then((session) => { tts = session; });
  postMessage({ type: 'cache-backend', backend: cacheBackend(useOpfsCache) });
  return loading;
}

async function speak({ id, text }) {
  if (!tts) throw new Error('TTS model is not initialized.');
  const wav = await tts.predict(text);
  const { pcm, sampleRate } = await wavBlobToPcm(wav);
  postMessage({ type: 'audio', id, pcm, sampleRate }, [pcm.buffer]);
}

function cacheBackend(useOpfsCache) {
  if (!useOpfsCache) return 'http-cache';
  return typeof globalThis.navigator?.storage?.getDirectory === 'function' ? 'opfs-available' : 'http-cache';
}

function progressMessage(progress) {
  if (typeof progress !== 'object' || progress === null) return { type: 'progress', area: 'tts', progress };
  const { file, progress: percent, status, loaded, total, url } = progress;
  const fallbackFile = typeof url === 'string' ? url.split('/').pop() : undefined;
  return { type: 'progress', area: 'tts', file: file ?? fallbackFile, progress: byteProgress(percent, loaded, total), status };
}

function byteProgress(percent, loaded, total) {
  if (typeof percent === 'number') return percent;
  if (typeof loaded !== 'number' || typeof total !== 'number' || total <= 0) return undefined;
  return Math.min(100, Math.max(0, loaded / total * 100));
}

async function wavBlobToPcm(blob) {
  const view = new DataView(await blob.arrayBuffer());
  if (readFourCc(view, 0) !== 'RIFF' || readFourCc(view, 8) !== 'WAVE') throw new Error('Unsupported Piper WAV output.');
  const fmt = findChunk(view, 'fmt ');
  const data = findChunk(view, 'data');
  if (!fmt || !data) throw new Error('Invalid Piper WAV output.');
  return { pcm: pcm16ToFloat32(view, data.offset, data.size, view.getUint16(fmt.offset + 2, true)), sampleRate: view.getUint32(fmt.offset + 4, true) };
}

function pcm16ToFloat32(view, offset, byteLength, channels) {
  const frameCount = Math.floor(byteLength / (2 * channels));
  const pcm = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) pcm[frame] = averageFrame(view, offset, frame, channels);
  return pcm;
}

function averageFrame(view, offset, frame, channels) {
  let sum = 0;
  for (let channel = 0; channel < channels; channel += 1) sum += view.getInt16(offset + (frame * channels + channel) * 2, true) / 32768;
  return sum / channels;
}

function findChunk(view, id) {
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    if (readFourCc(view, offset) === id) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  return null;
}

function readFourCc(view, offset) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
