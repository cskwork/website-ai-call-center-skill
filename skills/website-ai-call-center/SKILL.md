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
- Keep local call scenarios in YAML source files with generated runtime data, not hidden UI conditionals.

## Workflow

1. Find the website entry point and static asset path.
2. Add the built JS/CSS or copy the template source into the app.
3. Register safe page actions for navigation, scrolling, focus, or highlighting.
4. Put local call scenarios in YAML: id, catalog_order, scenario_intent, title, utterances, match keywords, reply, workflow issue_type, and frontend action ids.
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

For static demos, use the `scenarios/*.yml` pattern:

- Add a scenario by adding one YAML file.
- Remove a scenario by deleting that YAML file.
- Change local routing by editing `match.keywords`.
- Change the spoken/written answer by editing `reply.text`.
- Change backend routing by editing `workflow.issue_type`.
- Change what the assistant may do by editing `frontend_actions`, then registering matching safe action ids.
- Run `npm run scenarios:build` after YAML changes.

Render demo phrase buttons and visible scenario cards from the generated runtime catalog so reviewers can see the call flow without reading control-flow code.

## Intent detection rule

Default local detection is deterministic keyword scoring from YAML `match.keywords`. Production systems may use an LLM or classifier, but it should return a `scenario_intent`, not arbitrary page instructions. Resolve that intent through the approved catalog and execute only registered `frontend_actions`.

Keep these fields separate:

- `scenario_intent`: user need.
- scenario file: approved response and action plan.
- `workflow.issue_type`: backend/handoff route.
- `frontend_actions`: safe browser callbacks.

## Review checklist

- No mandatory backend speech service was introduced.
- No large model binary was committed.
- User sees first-download/model progress.
- Text fallback works without microphone permission.
- Local scenarios are discoverable in YAML source files or a documented backend workflow.
- Assistant actions are registered callbacks, not arbitrary generated code.
- Browser smoke covers the real page or the vanilla template.
