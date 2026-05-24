# Integration Guide

## 1. Pick the smallest integration surface

Use the IIFE build for static sites and CMS pages. Use ESM imports for bundler apps.

## 2. Register safe page actions

Actions are callbacks you own. The assistant can request an action id, but it cannot execute arbitrary page code.

```js
const actions = createSafeActionRegistry();
actions.register({ id: 'show-account', label: 'Show account', run: () => document.querySelector('#account')?.scrollIntoView() });
```

## 3. Choose speech adapters

Use `createWasmSttAdapter()` for browser speech recognition with the default `onnx-community/distil-small.en` model and `q4` dtype. Use `createPiperTtsAdapter()` for local Piper TTS. Pass `createNoopTtsAdapter()` as fallback when the browser Speech API must not be used.

## 4. Choose an AI engine

Start with `createLocalRuleEngine({ scenarios })` for zero infrastructure. Upgrade to `createHttpEngineAdapter({ endpoint })` when you have a server or hosted AI workflow.

The HTTP endpoint receives JSON messages:

```json
{ "type": "message", "sessionId": "...", "text": "user text", "context": {} }
```

It should return:

```json
{ "text": "assistant reply", "actions": [{ "id": "show-account", "label": "Show account" }] }
```


## Worker asset placement

For script-tag users, copy the full `dist/` folder so `website-ai-call-center.iife.js` and `workers/` stay together.

For ESM/bundler users, pass explicit worker URLs:

```js
const { sttWorkerUrl, ttsWorkerUrl } = createWorkerAssetUrls(new URL('/dist/', location.href));
const stt = createWasmSttAdapter({ workerUrl: sttWorkerUrl });
const tts = createPiperTtsAdapter({ workerUrl: ttsWorkerUrl });
```
