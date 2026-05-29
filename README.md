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
  locale: 'ko', // optional; defaults to 'en'. Accepts BCP-47-ish tags ('ko-KR' -> 'ko').
  actionRegistry: actions,
  stt: createWasmSttAdapter({ modelId: 'onnx-community/distil-small.en', dtype: 'q4' }),
  tts: createPiperTtsAdapter({ fallback: createNoopTtsAdapter() }),
  engine: createHttpEngineAdapter({ endpoint: '/api/support-call' }),
});
```

## Internationalization (i18n)

The overlay UI ships built-in English (`en`, default) and Korean (`ko`) strings. English is the
fallback for any missing value. There are no i18n libraries or runtime dependencies; localization
is plain frozen string maps.

### SDK options: `locale` and `strings`

Both options are optional and backward compatible. With neither set, behavior is unchanged English.

```js
const center = createWebsiteCallCenter({
  locale: 'ko',          // matched against ['en','ko']; region/case-insensitive; falls back to 'en'.
  strings: {             // optional deep-merge overrides on top of the resolved locale.
    title: 'Help desk',
    status: { listening: 'Listening now' },
  },
  engine,
});
```

- `locale` is resolved with `resolveLocale(requested)` (`'ko-KR'` -> `'ko'`, unknown -> `'en'`).
- `strings` deep-merges over the locale dictionary; unspecified keys keep the locale default.
- If `options.title` is provided it overrides the localized `title` (caller-localized title wins).
- Strings are built with `createUiStrings(locale, overrides)` and returned deeply frozen.

### Live language switching

The returned center exposes `setLocale(locale)` and `setStrings(overrides)`; both recompute the
overlay strings and re-render the status pill and footer controls live with no reload:

```js
center.setLocale('ko');               // swap to Korean live
center.setStrings({ send: 'Submit' }); // override individual keys in the current locale
```

Exposed i18n primitives (also available on `window.WebsiteAICallCenter` in the IIFE build):
`createUiStrings`, `resolveLocale`, `UI_STRINGS`, `UI_LOCALES`, `DEFAULT_LOCALE`, `controlsForState`.

### Landing page language toggle

The landing page (`site/index.html` + `site/landing.js` + `site/i18n.js`) renders an `EN | KO`
toggle (`#lang-toggle`) next to the theme toggle. Initial locale precedence:
`?lang=` URL param -> `localStorage['waicc-locale']` -> `navigator.language` -> `'en'`. The choice
persists to `localStorage`, syncs `<html lang>`, swaps every `[data-i18n]` text node via
`textContent`, re-renders the phrase buttons and scenario catalog in the active locale, and calls
`center.setLocale(locale)` so the overlay follows. English text stays inline in the HTML as the
no-JS default. All localized landing strings live in `site/i18n.js` (`LANDING_STRINGS.en` / `.ko`).


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

### Scenario localization (`i18n.ko`)

Each scenario may carry an optional top-level `i18n.ko` block to localize the catalog, demo phrase,
reply, and action labels for Korean. Every field is optional and falls back field-by-field to the
English (top-level) values, so partial translations are safe. Action `id`s may not be invented in
`i18n.ko`: every `frontend_actions[].id` under `i18n.ko` must already exist in the English
`frontend_actions` (only the `label` is localized). The build throws a clear error otherwise.

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
i18n:
  ko:
    title: 오디오 설정
    button_label: 소리가 안 나와요
    summary: 헤드셋, 스피커, 음소거, 브라우저 권한을 점검하도록 안내합니다.
    utterances: [상담 중에 소리가 안 들려요, 스피커가 음소거됐어요, 소리가 안 나와요]
    reply:
      text: 오디오 설정을 안내해 드릴게요. 헤드셋 패널부터 확인하세요.
    frontend_actions:
      - id: show-audio
        label: 오디오 설정 보기
    match:
      keywords: [소리, 오디오, 스피커, 음소거]
```

The generator emits a `localized: { en, ko }` map per scenario alongside the flat English fields
(kept for back-compat). Keyword matching is locale-agnostic: `terms` is the deduped **union** of the
English and Korean `match.keywords`, so Korean input matches even when the UI is English and vice
versa. At runtime, `getScenarioReply(text, locale)` and `getScenarioReplyForIntent(intent, locale)`
return the reply text and action labels for the requested locale (English fallback);
`localizedScenario(scenario, locale)` returns the per-locale catalog view used by the landing page.

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

See `docs/integration.md`, `docs/privacy.md`, `docs/compliance.md`, and `docs/browser-support.md` before production use.

`examples/vanilla/` is intentionally self-contained: it implements page actions, a scenario engine, Transformers.js WASM STT, Piper WASM TTS, and a text path that does not preload speech models until Prepare is clicked.
