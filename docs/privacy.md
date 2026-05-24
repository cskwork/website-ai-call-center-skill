# Privacy and Cache Model

## Local by default

The local rule engine keeps user text in the browser. WASM STT and Piper TTS download model files to the browser and run speech processing locally when supported.

## What can leave the browser

- `createLocalRuleEngine`: nothing by default.
- `createHttpEngineAdapter`: user text and context are sent to the configured endpoint.
- `createWasmSttAdapter`: model files may be fetched from the configured model host unless `useLocalModels` is enabled.
- `createPiperTtsAdapter`: voice and WASM assets may be fetched from configured CDN paths.

## Cache rules

Large model files belong in browser model cache layers such as CacheStorage or OPFS. Use localStorage only for tiny manifests, user preferences, or status flags.

## Production checklist

- Tell users when a first model download will happen.
- Show progress and failure states.
- Provide a no-microphone text fallback.
- Do not log transcripts unless the user has opted in.
- If using an HTTP AI endpoint, document retention and redaction rules.
