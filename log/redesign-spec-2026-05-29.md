# Redesign + i18n + Quality Spec (2026-05-29)

Authoritative contract for the website-ai-call-center-skill upgrade. Every implementer agent
keys off THIS file. Do not invent alternate key names, option names, or locales.

Repo root: `/Users/danny/website-ai-call-center-skill`

## 0. Hard constraints (non-negotiable)

- **Backward compatible.** `createWebsiteCallCenter(options)` existing usage must keep working
  unchanged: `{ title, mount, actionRegistry, actions, engine, scenarios, stt, tts }`.
  New options (`locale`, `strings`) are OPTIONAL; with neither provided, behavior == current English.
  `examples/vanilla/main.js` must keep working with NO edits required (verify, do not rewrite it).
- **No new runtime dependencies.** Vanilla ESM/JS only, matching the repo. No frameworks, no i18n libs.
- **No emoji anywhere.** Use inline SVG icons (see §2). Emoji is banned in all output.
- **Locales:** `en` (default) and `ko`. EN is the fallback for any missing KO value.
- **All existing tests pass + add new ones.** `npm test` must stay green; generated scenarios must be
  regenerated so `node scripts/build-scenarios.mjs --check` passes.
- **Style:** functions <=50 lines, files small, immutable updates (spread, no input mutation),
  JSDoc on exported functions, explicit error handling at boundaries, no `console.log` in shipped code.
- **Implementers edit SOURCE only.** Do NOT run `npm run build` / `npm run site:build` (the integration
  phase owns all builds and dist/). You MAY run `node --test tests/<your-new>.test.mjs` and, if you own
  scenarios, `node scripts/build-scenarios.mjs`.
- **Security:** never inject untrusted text via innerHTML. SVG/static markup may use template strings;
  any locale/scenario/user text rendered into the DOM must go through `textContent` or an escape helper.

## 1. File ownership map (prevents parallel conflicts)

- **SDK agent** owns ONLY: `src/**` (all of it) + new `src/i18n/*` + `tests/i18n.test.mjs` +
  `tests/overlay-controls.test.mjs`.
- **Scenario agent** owns ONLY: `schemas/call-scenario.schema.json`, `scripts/build-scenarios.mjs`,
  `scenarios/*.yml`, `site/scenarios.js`, and regenerated `site/generated/scenarios.js`
  (via `node scripts/build-scenarios.mjs`), + extend `tests/site-scenarios.test.mjs` and
  `tests/scenario-yaml-build.test.mjs`.
- **Landing agent** owns ONLY: `site/index.html`, `site/styles.css`, `site/landing.js`, new `site/i18n.js`.
- Nobody else touches `dist/`, `node_modules/`, `_site/`, `examples/`, `package.json`, `vite.*`.
- README + changelog are written in the integration phase.

## 2. SDK i18n + overlay UX redesign (SDK agent)

### 2.1 New `src/i18n/ui-strings.js`

```js
export const UI_LOCALES = Object.freeze(['en', 'ko']);
export const DEFAULT_LOCALE = 'en';
export const UI_STRINGS = Object.freeze({
  en: Object.freeze({
    fab: 'Support',
    title: 'AI support call',
    close: 'Close',
    inputLabel: 'Message',
    inputPlaceholder: 'Describe the problem',
    send: 'Send',
    voiceStart: 'Voice',
    voiceStop: 'Stop listening',
    prepare: 'Prepare voice',
    stopSpeaking: 'Stop',
    end: 'End',
    prepareHint: 'Press Prepare to enable local voice.',
    status: Object.freeze({
      idle: 'Ready', preparing: 'Loading models…', listening: 'Listening…',
      thinking: 'Thinking…', speaking: 'Speaking…', ended: 'Call ended', error: 'Something went wrong',
    }),
  }),
  ko: Object.freeze({
    fab: '고객지원',
    title: 'AI 상담',
    close: '닫기',
    inputLabel: '메시지',
    inputPlaceholder: '무엇을 도와드릴까요?',
    send: '보내기',
    voiceStart: '음성',
    voiceStop: '듣기 중지',
    prepare: '음성 준비',
    stopSpeaking: '중지',
    end: '종료',
    prepareHint: '로컬 음성을 켜려면 준비를 누르세요.',
    status: Object.freeze({
      idle: '대기 중', preparing: '모델 불러오는 중…', listening: '듣는 중…',
      thinking: '처리 중…', speaking: '말하는 중…', ended: '상담 종료', error: '문제가 발생했어요',
    }),
  }),
});
```

### 2.2 New `src/i18n/resolve-locale.js`

- `resolveLocale(requested, available = UI_LOCALES, fallback = DEFAULT_LOCALE)`: normalize a BCP-47-ish
  tag (`'ko-KR'`→`'ko'`, `'en-US'`→`'en'`, case-insensitive, trims region). Return the matched available
  locale or `fallback`. Accept `undefined`/`null` safely.
- `createUiStrings(locale, overrides = {})`: deep-merge `UI_STRINGS[fallback]` <- `UI_STRINGS[locale]`
  <- `overrides`. Return a deeply frozen object. Missing KO keys fall back to EN. Pure, no mutation.

### 2.3 Overlay redesign — `src/ui/overlay.js` + `src/ui/overlay.css`

Refactor `createOverlay` to take `{ mount, strings, title, onEvent, onAction }`. Prefer closure capture of
`root` over `this`-binding (the current `this.root` pattern is fragile — replace it).

**Layout:** header (title + close ×) · status pill (colored dot + `strings.status[state]`) ·
progress bar (visible only while preparing or 0<progress<100) · messages · textarea(+label) · footer controls.

**State-driven control visibility — extract a PURE, unit-testable function:**

```js
/** @returns {{ voice:{show,mode,label}, send:{show}, stopSpeaking:{show}, end:{show} }} */
export function controlsForState(state, prepared, strings) { ... }
```
Rules:
- `send.show`: always true (text path always available).
- `voice` button morphs (single button, no separate Prepare/Voice/Stop-listening):
  - `!prepared` → mode `'prepare'`, label `strings.prepare`, icon `mic-off`.
  - `prepared && state==='listening'` → mode `'stop'`, label `strings.voiceStop`, icon `stop`.
  - `prepared && state!=='listening'` → mode `'start'`, label `strings.voiceStart`, icon `mic`.
- `stopSpeaking.show`: only when `state==='speaking'` (stops TTS). Icon `stop`. command `stop`.
- `end.show`: only when session active — `prepared===true || ['preparing','listening','thinking','speaking'].includes(state)`. Icon `hangup`.
- Idle + not prepared (fresh) ⇒ footer shows only [Prepare-mode voice button] + [Send]. Matches approved mock.

**Commands (data-waicc):** `send`, `voice` (smart), `stop` (stop TTS), `end`. The smart `voice` command is
resolved in create-call-center (see §2.4) using current state+prepared. Keep `onAction(actionId)` for
dynamic safe-action buttons in `.waicc-actions`.

**Icons:** inline SVG (stroke=currentColor, width/height 18, aria-hidden). Provide: mic, mic-off, stop,
send (arrow), hangup, close. Icon-only buttons MUST have `aria-label` = the localized label.

**Overlay public API (object returned):** `{ root, setOpen, setControls, setProgress, addMessage,
setActions, setTranscript, setStrings, destroy }`.
- `setControls({ state, prepared })`: re-render status pill text/dot + footer button visibility/labels/icons.
- `setStrings(strings)`: swap fab/title/close/input label/placeholder/static labels, then re-run setControls
  with last known {state, prepared}. Used for live language switch.
- Keep `addMessage(role, text)` using textContent (safe). `setActions` builds buttons with textContent labels.

**Accessibility:** panel `role="dialog" aria-modal="true"`; implement a focus trap (Tab/Shift+Tab cycle
within panel); Escape closes (keep); return focus to fab on close (keep); status `aria-live="polite"`;
messages `aria-live="polite"`. The morphing voice button updates `aria-label` per mode.

**CSS:** keep the glass/gradient aesthetic; ensure controls wrap nicely on narrow widths; primary Send button
visually distinct (accent gradient); icon buttons square-ish 40px min touch target; respect
`prefers-reduced-motion`; add a Korean-capable font fallback to `--waicc` font stack
(`Inter, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif`).

### 2.4 `src/core/create-call-center.js`

- Accept `options.locale` (default `'en'`) and `options.strings` (overrides). Compute
  `const strings = createUiStrings(resolveLocale(options.locale), options.strings)`.
  If `options.title` is provided, it overrides `strings.title` (caller-localized title wins).
- Pass `strings` to `createOverlay`. Maintain a `let prepared = false;` flag — set true at end of
  `prepare()`, false on `endCall()`/error during prepare.
- After every state change AND after prepare/end, call `overlay.setControls({ state: machine.getState(), prepared })`.
- Smart `voice` command handler: `if (!prepared) return prepare(); if (state==='listening') return stopVoice(); return startVoice();`
- Add to returned center: `setLocale(locale)` and `setStrings(overrides)` →
  recompute strings, call `overlay.setStrings(next)`. Keep all existing returned methods
  (`on, prepare, startVoice, stopVoice, sendText, endCall, destroy, getState`).
- `prepare()` must restore a sane state on failure (transition to 'error' is handled by onEvent catch; ensure
  `prepared` stays false on throw).

### 2.5 `src/api.js`

Add exports: `createUiStrings`, `resolveLocale`, `UI_STRINGS`, `UI_LOCALES`, `DEFAULT_LOCALE`,
`controlsForState`. Keep all existing exports.

### 2.6 SDK function quality pass (whole `src/`)

Apply audit findings from `log/audit-sdk.md`. Add JSDoc to every exported function. Tighten error handling
(e.g., engine/stt/tts adapter calls). Preserve immutability and all public contracts. Keep diffs surgical —
do not gratuitously rewrite working internals.

## 3. Scenario i18n (Scenario agent)

### 3.1 Schema `schemas/call-scenario.schema.json`

Add optional top-level `i18n` (additionalProperties false) with a `ko` property referencing a
`$defs.localizedScenario`: object, additionalProperties false, ALL optional:
`title, button_label, summary, utterances(array minItems1), reply({text}), frontend_actions(array of {id,label}), match({keywords})`.
Reuse existing field constraints. Do NOT make `i18n` required.

### 3.2 `scripts/build-scenarios.mjs` — `toRuntimeScenario`

Emit a `localized` map alongside existing flat EN fields (keep flat EN fields for back-compat):

```js
localized: {
  en: { title, buttonLabel, summary, phrase, utterances, replyText, actions },
  ko: { ...en defaults overridden by entry.i18n?.ko (field-by-field fallback to en)... },
}
```
- `terms`: UNION of EN `match.keywords` + `i18n.ko.match.keywords` (deduped, normalized). Matching stays
  locale-agnostic so KO input matches even when UI is EN and vice-versa.
- Assert: every `i18n.ko.frontend_actions[].id` exists in the EN `frontend_actions` ids (labels may localize,
  ids may not be invented). Throw a clear error otherwise.
- Keep `assertUnique`, ordering, freezeExpression behavior.

### 3.3 `site/scenarios.js`

- `getScenarioReply(text, locale = 'en')` and `getScenarioReplyForIntent(intent, locale = 'en')`:
  resolve scenario, then return reply with `text` and `actions[].label` taken from
  `scenario.localized[locale]` with EN fallback. Keep `scenarioId`, `scenario_intent`, `workflow`.
- Matching uses the union `terms` (unchanged scoring) so it is locale-agnostic.
- `DEFAULT_SCENARIO` gets a `localized: { en, ko }` block too (KO below).
- Export a helper for the catalog UI: `localizedScenario(scenario, locale)` returning the per-locale view
  (title, buttonLabel, summary, phrase, replyText, actions, terms) with EN fallback. Landing uses it.

### 3.4 KO translations for `scenarios/*.yml` (add `i18n.ko` block to each)

Use these EXACT Korean strings (natural, professional support tone — 존댓말):

**audio.yml** i18n.ko:
- title: `오디오 설정`
- button_label: `소리가 안 나와요`
- summary: `헤드셋, 스피커, 음소거, 브라우저 권한을 점검하도록 안내합니다.`
- utterances: [`상담 중에 소리가 안 들려요`, `스피커가 음소거됐어요`, `소리가 안 나와요`]
- reply.text: `오디오 설정을 안내해 드릴게요. 헤드셋 패널부터 확인하고, 그래도 음성이 안 되면 브라우저 점검을 실행하세요.`
- frontend_actions: [{id: show-audio, label: `오디오 설정 보기`}, {id: run-checks, label: `브라우저 점검 실행`}]
- match.keywords: [`소리`, `오디오`, `스피커`, `음소거`, `안 들`, `안들`]

**account.yml** i18n.ko:
- title: `계정 찾기`
- button_label: `계정 설정 찾기`
- summary: `계정, 설정, 프로필, 로그인 도움말이 어디 있는지 안내합니다.`
- utterances: [`계정 설정을 못 찾겠어요`, `프로필 페이지가 어디예요`, `로그인 설정이 필요해요`]
- reply.text: `계정 경로로 안내해 드릴게요. 등록된 페이지 영역으로만 동작을 제한합니다.`
- frontend_actions: [{id: show-account, label: `계정 경로 보기`}]
- match.keywords: [`계정`, `설정`, `프로필`, `로그인`]

**diagnostics.yml** i18n.ko:
- title: `브라우저 진단`
- button_label: `진단 실행`
- summary: `보안 컨텍스트, WASM, 워커, 저장소, 마이크 접근을 정직하게 로컬에서 점검합니다.`
- utterances: [`페이지가 오프라인이라고 떠서 진단이 필요해요`, `네트워크 점검이 실패해요`, `브라우저 진단을 실행해 주세요`]
- reply.text: `브라우저 기능을 정직하게 점검하고 진단 카드를 보여드릴게요.`
- frontend_actions: [{id: run-checks, label: `브라우저 점검 실행`}]
- match.keywords: [`오프라인`, `진단`, `네트워크`, `페이지`]

**ticket.yml** i18n.ko:
- title: `티켓 작성`
- button_label: `티켓 작성`
- summary: `수집된 문제, 페이지 경로, 음성 모드로 에스컬레이션 초안을 만듭니다.`
- utterances: [`기술 지원 티켓을 작성하고 싶어요`, `상담원에게 에스컬레이션해 주세요`, `지원 케이스를 만들어 주세요`]
- reply.text: `현재 페이지 경로와 문제 요약으로 지원 티켓 초안을 작성해 드릴게요.`
- frontend_actions: [{id: draft-ticket, label: `지원 티켓 작성`}]
- match.keywords: [`티켓`, `케이스`, `상담원`, `지원`, `에스컬`]

**DEFAULT_SCENARIO** (in site/scenarios.js) ko localized:
- title: `기본 안내`
- buttonLabel: `일반 도움말`
- summary: `일치하는 시나리오가 없을 때 가장 안전한 시작점을 제시합니다.`
- phrase: `이 페이지에 대해 도움이 필요해요`
- replyText: `이 정적 페이지를 안내해 드릴게요. 오디오 설정, 계정 설정, 진단, 티켓 작성 중에서 시도해 보세요.`
- actions: [{id: show-audio, label: `오디오 설정 보기`}, {id: run-checks, label: `브라우저 점검 실행`}]

## 4. Landing redesign + i18n (Landing agent)

### 4.1 New `site/i18n.js`

- `LANDING_STRINGS = { en: {...}, ko: {...} }` keyed by the `data-i18n` attribute names used in index.html.
  Cover EVERY static string: nav links, eyebrows, all h1/h2/h3, all paragraphs, badge items, button labels,
  FAQ summaries+answers, the 5 check-card titles+descriptions+button label, footer text, AND the dynamic
  strings currently hardcoded in landing.js (status fallbacks, check pass/warn/fail messages, demo notes,
  diagnostics summary template, ticket draft template labels).
- `resolveInitialLocale()`: precedence `?lang=` URL param → `localStorage['waicc-locale']` → `navigator.language`
  → `'en'`. Normalize via same rules as SDK resolveLocale (`ko-*`→`ko`).
- `getLocale()`, `applyLocale(locale, { persist = true })`: set `document.documentElement.lang`,
  persist to localStorage when persist, swap all `[data-i18n]` text via `textContent`, swap
  `[data-i18n-attr]` (e.g. placeholders/aria-labels if any), update the toggle's pressed state, fire callbacks.
- `onLocaleChange(cb)` registry. Keep English text inline in index.html as the no-JS default.

KO landing copy: translate naturally and professionally (developer-tool marketing tone, 존댓말/명사형 혼용
as appropriate for headings). Examples (translate the rest in the same register):
- hero h1 `Add a private AI call-center to any website.` → `어떤 웹사이트에든 프라이빗 AI 콜센터를 더하세요.`
- eyebrow `Static-site AI support overlay` → `정적 사이트용 AI 지원 오버레이`
- nav: Demo→`데모`, Scenarios→`시나리오`, Architecture→`아키텍처`, Test path→`테스트 경로`, Start→`시작하기`
- badges: `100% client-side`→`100% 클라이언트 측`, `Lazy model load`→`지연 모델 로드`
- buttons: `Try the live demo`→`라이브 데모 보기`, `View on GitHub`→`GitHub에서 보기`

### 4.2 `site/index.html`

- Add a language toggle in `.site-header` next to the theme toggle: a button (or EN|KO segmented control)
  `id="lang-toggle"` with `aria-label`. Keep `<html lang="en">` (i18n.js updates it).
- Add `data-i18n="<key>"` to every text-bearing element. Keep the existing English text as the default content.
- Keep relative asset paths (GitHub Pages project path). Keep structure/sections; you MAY improve markup for
  design (see 4.4) but preserve all existing ids/anchors used by landing.js and nav (`#demo`, `#scenarios`,
  `#architecture`, `#test-path`, `#start`, `#hero`, `#target-*`, `#phrase-grid`, `#scenario-catalog`,
  `#hero-status`, `#model-progress`, `#diagnostic-copy`, `#ticket-draft`, tab ids, check `data-check` rows).

### 4.3 `site/landing.js`

- Import from `./i18n.js` and `./scenarios.js`. On DOMContentLoaded: `resolveInitialLocale()` → `applyLocale`,
  wire `#lang-toggle`. Build SDK overlay with `locale` passed through:
  `sdk.createWebsiteCallCenter({ locale, actionRegistry, engine, ...adapters })` (omit hardcoded `title` so the
  SDK localized title is used; or pass localized title from LANDING_STRINGS).
- Engine `sendUserText(text)` → `getScenarioReply(text, getLocale())`.
- On locale change: `applyLocale`, re-render phrase buttons + scenario catalog via `localizedScenario(.., locale)`,
  and `center.setLocale(locale)` (updates overlay strings live).
- Replace ALL hardcoded English UI strings in landing.js with `LANDING_STRINGS[getLocale()]` lookups
  (status text, check messages, notes, diagnostics summary, ticket draft).
- Keep all existing behavior (waveform, tabs, checks, copy button, active-nav, theme). Keep functions <=50 lines.

### 4.4 `site/styles.css` design improvements

Apply concrete upgrades from `log/audit-design.md`. Keep the existing visual language (dark/light themes,
glass cards, gradient glow blobs, Inter + JetBrains Mono). Elevate quality:
- Coherent spacing/type scale via CSS custom properties; stronger vertical rhythm; refined hero hierarchy.
- Polished cards (consistent radius/shadow/border, hover states), better section dividers, refined nav with
  clear active state, styled language + theme toggles (segmented look).
- Add `Noto Sans KR` to the Google Fonts `<link>` in index.html (CDN, not a dependency) and a Korean font
  fallback in the body font stack so KO renders well in both themes.
- Responsive polish (mobile nav wrap, hero stacks cleanly, demo layout, scenario grid), AA contrast in both
  themes, visible focus rings, honor `prefers-reduced-motion`.
- Do not regress existing animations/utility classes that landing.js relies on (`.waicc-highlight` is in the
  SDK css, not here).

## 5. Verification (integration phase)

Run in order from repo root, fix any failure before proceeding:
1. `node scripts/build-scenarios.mjs` (regenerate site/generated/scenarios.js)
2. `npm test`
3. `npm run build`
4. `npm run site:build`
5. `npm run smoke:site`
6. `npm run smoke:browser`
Then update `README.md` (document `locale`/`strings` options, scenario `i18n.ko` block, language toggle) and
write `log/changelog-2026-05-29.md` (decisions + why).

## 6. Acceptance criteria

- EN default everywhere; KO selectable on landing; `<html lang>` syncs; choice persists.
- Overlay shows minimal state-driven controls (no 5-button row); icons are SVG, all icon buttons labeled.
- Scenario catalog, phrases, overlay, and all landing copy switch EN/KO live with no English left over in KO.
- KO speech/text input matches scenarios (union terms).
- All six verification steps pass. `examples/vanilla` still loads (browser smoke).
- No new deps, no emoji, no console.log, backward-compatible SDK API.
