---
name: website-ai-call-center
description: Use when adding a framework-agnostic AI technical-support call center overlay to a website with browser WASM STT/TTS, optional HTTP AI, safe page actions, model progress, and minimal infrastructure.
metadata:
  short-description: Add a browser AI support call center
---

# Website AI Call Center

Use this skill to add a voice/text AI support overlay to any website without committing to a frontend framework or server speech backend.

## Default posture

- Static browser overlay first; ESM import when the app has a bundler.
- Browser WASM STT first: `onnx-community/distil-small.en`, dtype `q4`.
- Browser/local TTS first: Piper WASM; use `createNoopTtsAdapter()` fallback when the browser Speech API is not allowed.
- Local rule engine for zero-infra demos; HTTP engine for real AI workflows.
- AI may request only registered safe actions by id.
- Large model files go to browser cache/OPFS where possible, not localStorage.
- Keep local call scenarios in a visible catalog file, not hidden UI conditionals.

## Workflow

1. Find the website entry point and static asset path.
2. Add the built JS/CSS or copy the template source into the app.
3. Register safe page actions for navigation, scrolling, focus, or highlighting.
4. Put local call scenarios in one catalog: id, title, sample phrase, match terms, assistant reply, and safe action ids.
5. Pick STT/TTS adapters and show their progress events in the UI.
6. Start with local scenarios, then swap to an HTTP AI engine if needed.
7. Verify keyboard access, text fallback, model progress, TTS stop, and no arbitrary DOM execution.

## Integration shape

```js
const center = createWebsiteCallCenter({
  stt: createWasmSttAdapter(),
  tts: createPiperTtsAdapter({ fallback: createNoopTtsAdapter() }),
  engine: createLocalRuleEngine({ scenarios }),
  actions: {
    'show-help': () => document.querySelector('#help')?.scrollIntoView({ block: 'center' }),
  },
});
```

Read `references/integration.md` for copy-in steps.
Read `references/verification.md` before claiming completion.

## Scenario catalog rule

For static demos, use the `site/scenarios.js` pattern:

- Add a scenario by adding one object to `CALL_SCENARIOS`.
- Remove a scenario by deleting that object.
- Change routing by editing its `terms`.
- Change the spoken/written answer by editing `replyText`.
- Change what the assistant may do by editing `actions`, then registering matching safe action ids.

Render demo phrase buttons and visible scenario cards from the same catalog so reviewers can see the call flow without reading control-flow code.

## Review checklist

- No mandatory backend speech service was introduced.
- No large model binary was committed.
- User sees first-download/model progress.
- Text fallback works without microphone permission.
- Local scenarios are discoverable in one catalog file or a documented backend workflow.
- Assistant actions are registered callbacks, not arbitrary generated code.
- Browser smoke covers the real page or the vanilla template.
