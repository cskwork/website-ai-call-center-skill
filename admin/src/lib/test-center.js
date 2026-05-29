// SDK wiring for the in-builder live test. The admin app depends on the runtime
// SDK *source* (one-directional: the SDK never imports the admin), so the same
// createFlowEngine + overlay that ship in production drive the test. The default
// keyword resolver downloads nothing; voice is strictly opt-in.
//
// Voice mirrors examples/vanilla/main.js: WASM Whisper STT + Piper TTS workers,
// resolved from the deployed /dist/ folder (build-pages copies dist -> _site/dist,
// so from /admin/ the workers live at ../dist/). STT models are English-only, so
// spoken input is best tested with the English flow; typed input works in any locale.

import {
  createWebsiteCallCenter,
  createFlowEngine,
  createWasmSttAdapter,
  createPiperTtsAdapter,
  createNoopTtsAdapter,
  createWorkerAssetUrls,
} from '../../../src/api.js';
import '../../../src/ui/overlay.css';

const STT_MODEL_ID = 'onnx-community/distil-small.en';
const STT_DTYPE = 'q4';
const TTS_VOICE = 'en_US-hfc_female-medium';
const TTS_DTYPE = 'fp32';
const PIPER_WASM_PATHS = {
  onnxWasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
  piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
};

/**
 * Build the real WASM speech adapters pointed at the deployed worker bundles.
 * @returns {{ stt: object, tts: object }}
 */
function wasmSpeechAdapters() {
  const workerBase = new URL('../dist/', location.href);
  const { sttWorkerUrl, ttsWorkerUrl } = createWorkerAssetUrls(workerBase);
  return {
    stt: createWasmSttAdapter({ workerUrl: sttWorkerUrl, modelId: STT_MODEL_ID, dtype: STT_DTYPE, useOpfsCache: true }),
    tts: createPiperTtsAdapter({
      workerUrl: ttsWorkerUrl,
      fallback: createNoopTtsAdapter(),
      modelId: TTS_VOICE,
      voice: TTS_VOICE,
      dtype: TTS_DTYPE,
      useOpfsCache: true,
      wasmPaths: PIPER_WASM_PATHS,
    }),
  };
}

/**
 * Mount a real call-center overlay driven by the given bundle and return the
 * center plus a `dispose()` that fully releases it. With `voice` off, no models
 * download and the caller can test by typing; with `voice` on, the WASM speech
 * models load on the overlay's Prepare step.
 *
 * `center.destroy()` only removes the overlay DOM. Voice additionally holds a mic
 * stream (STT) and Web Workers (STT/TTS); `dispose()` stops those first so closing
 * the drawer, toggling voice, or remounting cannot leak a live microphone.
 *
 * @param {{ bundle: object, locale: 'en'|'ko', voice?: boolean, mount?: Element }} options
 * @returns {{ center: ReturnType<typeof createWebsiteCallCenter>, dispose: () => void }}
 */
export function mountTestCenter({ bundle, locale, voice = false, mount }) {
  const speech = voice ? wasmSpeechAdapters() : {};
  const center = createWebsiteCallCenter({
    title: bundle.tenant?.name || 'Assistant',
    locale,
    engine: createFlowEngine({ bundle, locale }),
    mount,
    ...speech,
  });

  function dispose() {
    // Release the microphone + speech workers before removing the DOM. STT keeps
    // a mic stream and an idle worker that its stop() does not free, so use its
    // destroy(); TTS frees its worker on stop(). Calls are wrapped so a sync throw
    // or an async rejection on one path cannot block the others or leak a rejection.
    safeCall(() => speech.stt?.destroy?.());
    safeCall(() => speech.tts?.stop?.());
    safeCall(() => center.endCall?.());
    center.destroy?.();
  }

  return { center, dispose };
}

/** Run a teardown step, swallowing both synchronous throws and async rejections. */
function safeCall(fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') result.catch(() => {});
  } catch {
    /* teardown is best-effort */
  }
}
