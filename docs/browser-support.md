# Browser Support and Performance

## Requirements

- Secure context for microphone access.
- Web Worker support for WASM STT/TTS adapters.
- MediaRecorder and AudioContext for microphone capture and PCM conversion.
- CacheStorage or OPFS for better model reuse; memory-only fallback may re-download.

## Default models

- STT: `onnx-community/distil-small.en`, dtype `q4`, WASM device.
- TTS: Piper voice `en_US-hfc_female-medium`, WASM runtime paths configurable.

These defaults mirror the reference browser module: Transformers.js `automatic-speech-recognition` on `device: "wasm"` for STT and `@mintplex-labs/piper-tts-web` `TtsSession` for TTS.

## Performance posture

- Initialize from a user gesture to avoid autoplay and permission blockers.
- Keep heavy inference in workers.
- Surface progress events instead of showing unlabeled spinners.
- Avoid requiring cross-origin isolation for the default path.
- Provide text input for low-power devices that should not preload speech models.

## Manual real-WASM smoke

1. Build the package.
2. Serve the repo on localhost.
3. Open the vanilla example; it already wires `createWasmSttAdapter()` and `createPiperTtsAdapter()`.
4. Click Prepare and confirm STT/TTS progress events.
5. Reload and confirm cache/backend progress is faster or reports cache reuse where supported.


## Deployment tradeoff

The built worker assets can be large because browser WASM STT/TTS bundles ONNX runtimes. This is the cost of avoiding mandatory speech infrastructure. Host `dist/workers/**` with long-lived cache headers and keep the text path enabled for slow networks.

Piper TTS cache behavior is controlled by the Piper runtime and browser HTTP cache. The adapter reports whether OPFS is available, but does not guarantee that every Piper asset is stored in OPFS.
