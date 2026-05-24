# Website AI Call Center Skill

A framework-agnostic skill and template for adding an AI technical-support call center to any website.

The default shape is static and minimal-infra: a browser overlay, a local scenario engine, safe page actions, browser WASM STT, Piper WASM TTS, and optional HTTP AI adapter when you want a real backend.

Live landing page target: `https://cskwork.github.io/website-ai-call-center-skill/`

## Why use it

- Works with static HTML, CMS pages, SPAs, and framework apps.
- No mandatory speech backend: STT/TTS adapters run in the browser when available.
- User guidance is safe by default: AI can suggest registered actions, not arbitrary DOM scripts.
- Performance posture: lazy model load, worker offload, progress events, browser cache/OPFS where supported.
- Reusable skill packaging for Codex, Claude Code, and other coding agents.

## Quick start

```bash
npm install
npm run build
python3 -m http.server 4173
# open http://127.0.0.1:4173/examples/vanilla/
```

GitHub Pages landing site:

```bash
npm run site:build
python3 -m http.server 4173 -d _site
# open http://127.0.0.1:4173/
```

Script-tag integration:

```html
<link rel="stylesheet" href="/dist/website-ai-call-center.css">
<script src="/dist/website-ai-call-center.iife.js"></script>
<script>
  const sdk = window.WebsiteAICallCenter;
  const center = sdk.createWebsiteCallCenter({
    engine: sdk.createLocalRuleEngine({ scenarios: [] }),
    stt: sdk.createWasmSttAdapter(),
    tts: sdk.createPiperTtsAdapter({ fallback: sdk.createNoopTtsAdapter() })
  });
</script>
```

ESM integration:

```js
import {
  createWebsiteCallCenter,
  createWasmSttAdapter,
  createPiperTtsAdapter,
  createNoopTtsAdapter,
  createHttpEngineAdapter,
  createSafeActionRegistry,
} from 'website-ai-call-center-skill';

const actions = createSafeActionRegistry({
  'open-help': () => document.querySelector('#help')?.scrollIntoView({ block: 'center' }),
});

const center = createWebsiteCallCenter({
  actionRegistry: actions,
  stt: createWasmSttAdapter({ modelId: 'onnx-community/distil-small.en', dtype: 'q4' }),
  tts: createPiperTtsAdapter({ fallback: createNoopTtsAdapter() }),
  engine: createHttpEngineAdapter({ endpoint: '/api/support-call' }),
});
```


## Worker assets

The IIFE build resolves workers relative to the script URL when `dist/workers/**` is copied beside the JS bundle. ESM and bundler users should pass explicit worker URLs:

```js
import { createWorkerAssetUrls, createWasmSttAdapter, createPiperTtsAdapter } from 'website-ai-call-center-skill';

const { sttWorkerUrl, ttsWorkerUrl } = createWorkerAssetUrls(new URL('/dist/', location.href));
const stt = createWasmSttAdapter({ workerUrl: sttWorkerUrl });
const tts = createPiperTtsAdapter({ workerUrl: ttsWorkerUrl });
```

Piper TTS cache behavior is runtime-managed by the Piper/ONNX stack. `preferOpfsCache` controls backend reporting and preference only; pass `createNoopTtsAdapter()` as the fallback when you want to avoid the browser Speech API entirely.

## Adapter contract

- STT adapter: `prepare(onProgress)`, `start(onTranscript)`, `stop()`.
- TTS adapter: `prepare(onProgress)`, `speak(text)`, `stop()`.
- Engine adapter: `startSession()`, `sendUserText(text, context)`, `endSession()`.
- Action registry: register allowed callbacks and execute by id only.

## Scenario management

The landing page keeps human-managed call flows in YAML files under `scenarios/`.
`scripts/build-scenarios.mjs` validates those files against `schemas/call-scenario.schema.json`
and generates `site/generated/scenarios.js` for the browser runtime.

Each scenario has:

- `id` and `title` for the visible catalog.
- `catalog_order` for stable display order.
- `scenario_intent` for the resolved user intent.
- `utterances` for example phrases and the demo button.
- `match.keywords` for local deterministic matching.
- `reply.text` for the assistant response.
- `frontend_actions` for registered safe page actions.
- `workflow.issue_type` for downstream routing or handoff.

```yaml
id: audio
catalog_order: 10
scenario_intent: audio_issue
title: Audio setup
utterances:
  - I cannot hear audio during a support call
match:
  keywords: [audio, hear, speaker]
reply:
  text: I can guide audio setup.
frontend_actions:
  - id: show-audio
    label: Show audio setup
workflow:
  issue_type: technical_support
```

Add, remove, or edit scenarios in `scenarios/*.yml`, then run:

```bash
npm run scenarios:build
```

`site/landing.js` renders the phrase buttons and visible scenario catalog from the generated runtime file.

## Intent detection

The current static demo detects intent with deterministic keyword scoring:

1. Normalize the user's text.
2. Score each YAML scenario by matching `match.keywords`.
3. Select the highest-scoring scenario.
4. Return its `scenario_intent`, `workflow.issue_type`, reply text, and approved `frontend_actions`.

For production call centers, replace only the intent resolver. An LLM, classifier, or contact-center workflow can return a `scenario_intent` such as `audio_issue`; the runtime should then call `getScenarioReplyForIntent(intent)` and execute only the scenario's approved `frontend_actions`. Keep these concepts separate:

- `scenario_intent`: what the user wants.
- `scenario`: the approved response/action plan for that intent.
- `workflow.issue_type`: backend routing or handoff category.
- `frontend_actions`: safe page callbacks registered by the website.

## Verification

```bash
npm run scenarios:build
npm test
npm run build
npm run site:build
npm run smoke:browser
npm run smoke:site
npm pack --dry-run --json
```

## GitHub Pages

This repository includes `.github/workflows/pages.yml`. On pushes to `main`, GitHub Actions runs tests, builds the SDK bundles, and copies `site/`, `dist/`, `examples/`, and `docs/` into `_site/`.

Deployment is guarded while the repo is private. GitHub Pages for private repositories requires a supported GitHub plan; when the repo is public or Pages is enabled on a supported private plan, the same workflow uploads and deploys the `_site/` artifact.

Notes for static hosting:

- All landing-page links use relative paths so project Pages works under `/website-ai-call-center-skill/`.
- The landing text path does not preload speech models.
- Voice mode remains WASM-based: Transformers.js STT and Piper TTS load lazily after the user clicks Prepare.
- GitHub Pages cannot add cross-origin isolation headers, so the template uses non-threaded/browser-safe WASM paths.

See `docs/integration.md`, `docs/privacy.md`, and `docs/browser-support.md` before production use.

`examples/vanilla/` is intentionally self-contained: it implements page actions, a scenario engine, Transformers.js WASM STT, Piper WASM TTS, and a text path that does not preload speech models until Prepare is clicked.
