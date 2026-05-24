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

### Scenario catalog

For a static landing or demo page, keep scenarios in YAML files instead of scattering `if` branches through UI code. The bundled landing page uses `scenarios/*.yml` as the human source, validates it with `schemas/call-scenario.schema.json`, and generates `site/generated/scenarios.js` for runtime use.

```yaml
id: audio
catalog_order: 10
scenario_intent: audio_issue
title: Audio setup
button_label: Audio is broken
summary: Guides headset, speaker, mute, and browser permission checks.
utterances:
  - I cannot hear audio during a support call
match:
  keywords:
    - audio
    - hear
    - speaker
reply:
  text: I can guide audio setup.
frontend_actions:
  - id: show-audio
    label: Show audio setup
workflow:
  issue_type: technical_support
```

To add, remove, or revise a local call flow, edit a YAML file, run `npm run scenarios:build`, and keep `frontend_actions` aligned with the safe action registry.

### Intent detection

The static demo detects intent by scoring the user's text against each scenario's `match.keywords`. This makes local demos deterministic and testable.

Production deployments can replace that resolver with an LLM or classifier:

1. Send transcript and page context to your model or support workflow.
2. Have it return a `scenario_intent` value, not arbitrary DOM code.
3. Resolve that intent through the approved scenario catalog.
4. Offer only the scenario's registered `frontend_actions`.

Keep `scenario_intent`, `workflow.issue_type`, and `frontend_actions` separate. The intent identifies the user's need, the workflow field routes backend/handoff handling, and frontend actions are the only page operations the assistant may request.

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
