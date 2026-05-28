# SDK Code-Quality Audit (2026-05-29)

Scope: all of `src/**` (core, ui, actions, engine, stt, tts, storage, api.js, index.js).
Authority: `log/redesign-spec-2026-05-29.md`. Findings ranked by severity. File paths absolute.

No i18n layer exists yet (`src/i18n/*` is absent). All UI strings are hardcoded English in
`src/ui/overlay.js`. No `console.*` anywhere in `src/`. No hardcoded secrets.

---

## CRITICAL

### C1. Fragile `this`-binding in overlay methods (spec §2.3 explicitly bans this)
File: `/Users/danny/website-ai-call-center-skill/src/ui/overlay.js`

`setState` (L73), `setOpen` (L63), `setProgress` (L79), `addMessage` (L86), `setActions` (L93),
`setTranscript` (L98) all read `this.root` / `this?.root`. They only work when invoked as a method
on the returned `api` object (`overlay.setState(...)`). They silently break the instant any method is
detached. Verified: a detached method has `this === undefined`, so `this.root` throws (or `this?.root`
no-ops, swallowing the call).

Concrete current/imminent breakage paths:
- `create-call-center.js` returns `destroy: overlay.destroy` and `getState: machine.getState`. Today
  `overlay.destroy` is the arrow `() => root.remove()` (closure, safe). But the spec's new public API
  adds `setOpen`, `setControls`, `setStrings`, etc. — if any consumer destructures or passes these as
  callbacks (`btn.onclick = center.someOverlayMethod`), `this` is lost and they throw.
- `setOpen` (L63) is defensively coded with `this?.root ? ... : null` and an early `return` when null.
  That means a detached `setOpen` does nothing AND reports no error — a swallowed failure (violates
  "never swallow silently", coding-style.md).
- `api.setOpen(false)` at L11 works only because it is a method call; this is accidental, not designed.

Fix (spec-mandated): refactor `createOverlay` to capture `root`/`els` via closure. Define every method
as a closure (`function setState(state){ ... els.status ... }`) inside `createOverlay` so `this` is
never referenced. This is required by spec §2.3 ("Prefer closure capture of `root` over `this`-binding
... replace it") and is a prerequisite for the new API surface
(`setControls`, `setStrings`, `setProgress`, `addMessage`, `setActions`, `setTranscript`, `setOpen`,
`destroy`).

### C2. No unhandled-error handling for `setActions`/`addMessage` when assistant response is malformed
File: `/Users/danny/website-ai-call-center-skill/src/core/create-call-center.js` L45-52

`handleAssistant` does `overlay.addMessage('assistant', response.text)` and
`overlay.setActions(response.actions || [])` with no guard that `response` is non-null. If an engine
adapter resolves `undefined`/`null` (e.g. `http-engine-adapter` returns `result.text || ''` so text is
safe, but a custom engine could return nothing), `response.text` throws a TypeError that escapes the
`onEvent` catch only if it happens inside the command chain. `sendText` is invoked via
`commands.sendText` → caught by `onEvent`'s `.catch(handleError)`, so it degrades to an `error` state —
acceptable — but `addMessage('assistant', undefined)` would render the literal nothing and `setActions`
on a non-array throws inside `.map`. Add a boundary guard: normalize `response` to
`{ text: String(response?.text ?? ''), actions: Array.isArray(response?.actions) ? response.actions : [] }`
before touching the overlay.

---

## HIGH

### H1. Missing JSDoc on every exported function (spec §0, §2.6)
The spec requires JSDoc on all exported functions. Currently only `src/tts/piper-tts-adapter.js` has any
JSDoc (typedefs + two `@returns`). The following exports have NONE and must get JSDoc:

- `src/core/create-call-center.js`: `createWebsiteCallCenter`
- `src/core/events.js`: `createEventBus`
- `src/core/state-machine.js`: `createCallStateMachine`
- `src/core/asset-base.js`: `resolveAssetUrl`, `createWorkerAssetUrls`
- `src/ui/overlay.js`: `createOverlay` (and the new `controlsForState` per §2.3)
- `src/actions/safe-actions.js`: `createSafeActionRegistry`, `createSelectorAction`
- `src/engine/local-rule-engine.js`: `createLocalRuleEngine`, `selectScenario`
- `src/engine/http-engine-adapter.js`: `createHttpEngineAdapter`
- `src/stt/wasm-stt-adapter.js`: `createWasmSttAdapter`
- `src/stt/noop-stt-adapter.js`: `createNoopSttAdapter`
- `src/stt/media-utils.js`: `blobTo16KhzPcm`, `downmixAudioBuffer`, `resampleLinear`
- `src/tts/noop-tts-adapter.js`: `createNoopTtsAdapter`
- `src/storage/opfs-cache.js`: `createOpfsCache`

### H2. WASM STT `prepare()` caches a rejected promise — no recovery, no degradation
File: `/Users/danny/website-ai-call-center-skill/src/stt/wasm-stt-adapter.js` L24-31

```
async function prepare(onProgress = report) {
  report = onProgress;
  if (ready) return ready;            // <-- if ready is a REJECTED promise, returns it forever
  worker = createWorker(...);
  ready = new Promise((resolve, reject) => wireWorker(resolve, reject));
  worker.postMessage({ type: 'init', ... });
  return ready;
}
```

If worker init fails (`onerror` → `rejectReady`), `ready` becomes a permanently-rejected promise. Every
later `prepare()` / `start()` returns that same rejection — the adapter is bricked for the session with
no retry. Unlike `piper-tts-adapter.js` (which has `markDegraded` + a `fallback` adapter), STT has NO
graceful-degradation path. This violates resilience.md (graceful degradation, retry). Spec §2.4 also
says `prepared` must stay `false` on throw and state should recover to a sane value.
Fix: on rejection, null out `ready`/`worker` so a subsequent attempt can retry; surface a clear error to
the caller; consider an optional STT fallback mirroring the TTS pattern.

### H3. `startVoice` transitions to `listening` BEFORE `getUserMedia` resolves; permission denial corrupts state
File: `/Users/danny/website-ai-call-center-skill/src/core/create-call-center.js` L24-27 +
`/Users/danny/website-ai-call-center-skill/src/stt/wasm-stt-adapter.js` L33-41

`startVoice` calls `machine.transition('listening')` then `await stt.start(...)`. Inside `stt.start`,
`navigator.mediaDevices.getUserMedia` can reject (user denies mic, insecure context). The rejection
propagates to `onEvent`'s `.catch(handleError)` → state goes `listening` → `error`, which is a valid
transition, so it self-heals. BUT the UI briefly shows "listening" with no audio capture, and `prepared`
(new flag in §2.4) is unaffected. Recommend: only transition to `listening` after `getUserMedia`
resolves, or revert on failure. At minimum document the ordering. Also: `getUserMedia` rejection is the
single most common runtime failure and deserves a specific, localized error message (spec status.error).

### H4. `onAction` reads `overlay.root.ownerDocument` with no null guard after destroy
File: `/Users/danny/website-ai-call-center-skill/src/core/create-call-center.js` L60-63

`actions.execute(id, { document: overlay.root.ownerDocument, overlay })`. After `destroy()` removes the
root from the DOM, `overlay.root` still exists (the detached node), so `ownerDocument` is non-null —
generally OK. But if a custom overlay returns `root: null` or destroy nulls it (a likely refactor in
§2.3), this throws. Guard with `overlay.root?.ownerDocument ?? globalThis.document`.

### H5. `safe-actions.execute` does not catch errors thrown by user `run()` functions
File: `/Users/danny/website-ai-call-center-skill/src/actions/safe-actions.js` L16-22

```
await entry.run({ ...context, action });
return { ok: true, id, label: entry.label };
```

If a registered action's `run` throws/rejects, the rejection escapes `execute`, then escapes `onAction`
in create-call-center (which has no try/catch around the `await actions.execute(...)`), and is NOT
emitted as `{ status: 'rejected' }`. The intended contract (L62: `result.ok ? 'done' : 'rejected'`) is
bypassed for thrown errors. Wrap `entry.run` in try/catch and return
`{ ok: false, id, reason: 'action_failed', error }` so the bus reliably reports rejection. This is a
boundary (user-supplied callback) and must handle failures explicitly (coding-style.md, security.md).

---

## MEDIUM

### M1. `stopVoice` assumes `stt.stop()` returns an object; null/undefined throws
File: `/Users/danny/website-ai-call-center-skill/src/core/create-call-center.js` L29-34

`const result = await stt.stop(); overlay.setTranscript(result.text || '');` — a custom STT adapter that
returns `undefined` makes `result.text` throw. The repo's own `noop` and `wasm` adapters always return an
object, but this is a public adapter boundary. Normalize: `const result = (await stt.stop()) || {};`.

### M2. `local-rule-engine.sendUserText` ignores the `context` argument it is documented to receive
File: `/Users/danny/website-ai-call-center-skill/src/engine/local-rule-engine.js` L18

`create-call-center` calls `engine.sendUserText(clean, { state: machine.getState() })`, but the local
engine's signature is `sendUserText(text)` — the context is silently dropped. Not a bug today, but the
inconsistency with `http-engine-adapter` (`sendUserText(text, context = {})`) is a latent trap. Make the
signature explicit (`sendUserText(text, context = {})`) even if unused, for contract symmetry.

### M3. `state-machine` allows `idle → thinking` and `idle → listening`, skipping `preparing`
File: `/Users/danny/website-ai-call-center-skill/src/core/state-machine.js` L2

`idle: ['preparing', 'listening', 'thinking', 'ended', 'error']`. `sendText` does
`machine.transition('thinking')` directly from idle without ever preparing. That is intentional for the
text path (text works without models), and matches spec §2.3 ("send always available"). Flagging for
awareness only: the new `prepared` flag (§2.4) is the real gate for voice; the state machine itself
permits text-from-idle by design. No change required, but the new `setControls({state, prepared})` logic
must NOT assume `state` reflects preparedness.

### M4. `escapeHtml`/`escapeAttr` exist but most static markup is built with raw template strings
File: `/Users/danny/website-ai-call-center-skill/src/ui/overlay.js` L14-32, L110-116

Only `title` is escaped (L17-18). The rest of `markup()` is trusted static HTML — acceptable per spec §0
("SVG/static markup may use template strings"). When i18n lands, ALL localized strings injected into
markup() (fab, close label, input label/placeholder, status, button labels) MUST go through `textContent`
or `escapeHtml`, never raw interpolation, because `strings`/`overrides` are caller-supplied (untrusted).
Current `addMessage` (L86-91, textContent) and `setActions`/`actionButton` (L102-108, textContent) are
correct models to follow. Keep them.

### M5. `setProgress` always renders the bar; spec wants it hidden unless preparing or 0<progress<100
File: `/Users/danny/website-ai-call-center-skill/src/ui/overlay.js` L79-84 + `overlay.css` L132-151

The progress bar `.waicc-progress` is always present in markup and visible. Spec §2.3 layout requires it
"visible only while preparing or 0<progress<100". Current code only sets width; it never toggles
visibility. Add a hidden/visible toggle keyed on state+progress.

### M6. `opfs-cache.match` swallows all errors as cache-miss (broad `catch {}`)
File: `/Users/danny/website-ai-call-center-skill/src/storage/opfs-cache.js` L33-42 and `stt-worker.js` L63

`match()` catches everything and returns `undefined` (cache miss). A genuine read corruption is
indistinguishable from "not cached". Acceptable for a cache (fail-open to network), but per
observability.md there is no signal at all. Consider a one-line debug hook (not console.log) or returning
a typed miss. Low urgency. `stt-worker.js` L63 `catch {}` similarly swallows OPFS wiring errors and falls
back silently — fine functionally, opaque operationally.

---

## LOW / INFO

### L1. `createEventBus.emit` mutates nothing but spreads payload each call — fine; no listener error isolation
File: `/Users/danny/website-ai-call-center-skill/src/core/events.js` L14-19

If one listener throws, the loop aborts and remaining listeners (including `'*'`) never fire. Consider
wrapping each `listener(event)` in try/catch so a single bad subscriber cannot break event fan-out.

### L2. `reportProgress` and `setProgress` clamp differently
`create-call-center.reportProgress` passes the raw event; `overlay.setProgress` clamps `event.progress`
0..100 (L80-81). Consistent enough. Note `Number(event.progress || 0)` turns `progress: 0` into `0` (ok)
but `progress: undefined` into `0` and a legitimately falsy-but-valid value is fine. No action.

### L3. `wasm-stt-adapter.createRecorder` references global `MediaRecorder` without existence check
File: `/Users/danny/website-ai-call-center-skill/src/stt/wasm-stt-adapter.js` L97-100

`MediaRecorder.isTypeSupported?.(...)` then `new MediaRecorder(...)`. If `MediaRecorder` is undefined
(old/SSR), this is a ReferenceError, not a clean adapter error. Guard with
`if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder unavailable.')`.

### L4. `piper-tts-adapter.prepare` returns `undefined` on success but `ready` (a promise) is cached
File: `/Users/danny/website-ai-call-center-skill/src/tts/piper-tts-adapter.js` L34-48

On the happy path `prepare` returns `undefined` (it `await ready` then falls off). On the second call it
returns `ready` (a resolved promise) at L36. Slight return-type inconsistency (sometimes `undefined`,
sometimes a `Promise`). Harmless since callers `await` it, but worth normalizing to always return `ready`.

### L5. `selectScenario` sort is not stable across equal scores
File: `/Users/danny/website-ai-call-center-engine/...` → `src/engine/local-rule-engine.js` L35-41

Ties resolve by V8's sort stability (stable in modern engines) but ordering of equal-score scenarios is
implicit. For determinism across the new union-`terms` matching (scenario agent's change), document or
add a tiebreak (e.g. scenario index). Info only — SDK agent does not own scenarios.

### L6. `index.js` re-exports everything via `export * from './api.js'`
File: `/Users/danny/website-ai-call-center-skill/src/index.js` L2

Fine, but note: when §2.5 adds `createUiStrings`, `resolveLocale`, `UI_STRINGS`, `UI_LOCALES`,
`DEFAULT_LOCALE`, `controlsForState` to `api.js`, they automatically surface through `index.js`. No
change needed here, but verify the new i18n exports are added to `src/api.js` (currently absent).

---

## Hardcoded English UI strings in `src/ui/overlay.js` (must move to i18n dictionary per spec §2.1/§2.3)

Every string below is currently inlined and must be sourced from `strings` (the `createUiStrings` result).
Mapping to the spec's `UI_STRINGS` keys:

| Location | Current literal | Spec i18n key |
|---|---|---|
| L1 default param | `'AI support call'` | `strings.title` (spec en: `'AI support call'`) |
| L16 fab button | `Support` | `strings.fab` (en `'Support'`, ko `'고객지원'`) |
| L18 close button `aria-label` | `Close` | `strings.close` (en `'Close'`, ko `'닫기'`) |
| L18 close button text | `×` | keep glyph; `aria-label` from `strings.close` |
| L19 status div | `Idle` | `strings.status.idle` (en `'Ready'`, ko `'대기 중'`) |
| L20 progress `aria-label` | `Model progress` | NOT in spec dict — add or keep static; recommend a `strings.progressLabel` or leave as static aria text (flag: spec §2.1 omits it) |
| L23 label text | `Message` | `strings.inputLabel` (en `'Message'`, ko `'메시지'`) |
| L23 textarea `placeholder` | `Describe the problem` | `strings.inputPlaceholder` (en `'Describe the problem'`, ko `'무엇을 도와드릴까요?'`) |
| L26 button | `Prepare` | `strings.prepare` (en `'Prepare voice'` per spec list / button label `'Prepare'`) — NOTE morphing voice button: spec §2.3 replaces the separate Prepare/Voice/Stop trio with ONE morphing button using `strings.prepare`/`strings.voiceStart`/`strings.voiceStop` |
| L27 button | `Voice` | `strings.voiceStart` (en `'Voice'`, ko `'음성'`) |
| L28 button | `Stop` | `strings.voiceStop` (en `'Stop listening'`) / `strings.stopSpeaking` (en `'Stop'`) — current single `Stop` button conflates two concerns; spec splits into voiceStop (stop listening) vs stopSpeaking (stop TTS) |
| L29 button | `Send` | `strings.send` (en `'Send'`, ko `'보내기'`) |
| L30 button | `End` | `strings.end` (en `'End'`, ko `'종료'`) |
| L75 setState text | `State: ${state}` | replace with status pill = `strings.status[state]` (NOT the raw `State: x` debug string) |
| L83 progress title | `${event.area} ${event.phase} ${value}%` | internal title attr; localize area/phase only if desired — info |

Additional spec strings not yet present anywhere in overlay.js (must be added when building the redesign):
- `strings.prepareHint` (en `'Press Prepare to enable local voice.'`, ko `'로컬 음성을 켜려면 준비를 누르세요.'`)
- `strings.status.preparing/listening/thinking/speaking/ended/error` (status pill text per state)
- All six SVG icons (mic, mic-off, stop, send, hangup, close) — none exist today; markup uses text glyph `×` only.

Note on the en `title` mismatch: spec §2.1 sets en `title: 'AI support call'` which matches the current
default param at L1. Good — backward compatible.

---

## Immutability review (spec §0)

- `events.js emit` spreads payload into a new object (L15) — immutable. OK.
- `state-machine.js` returns new result objects, never mutates `meta`/input — OK. `TRANSITIONS` frozen.
- `safe-actions.register` mutates a private `Map` (internal state, not caller input) — acceptable.
- `local-rule-engine` `DEFAULT_SCENARIOS` frozen; `selectScenario` builds new arrays via map/filter/sort
  (`sort` mutates the array it is called on, but it operates on the freshly `map`-created array, not the
  input `scenarios`) — OK.
- `media-utils` allocates new `Float32Array` outputs; `resampleLinear` returns a COPY even when rates
  match (`new Float32Array(input)`) — correctly immutable.
- No function mutates a caller-supplied argument. Immutability posture is good. The redesign must keep
  `createUiStrings` pure + deeply frozen (spec §2.2).

## Summary of required SDK-agent changes (cross-ref to fixes)
1. New `src/i18n/ui-strings.js` + `src/i18n/resolve-locale.js` (spec §2.1/§2.2).
2. Rewrite `overlay.js` to closure-capture `root`/`els` (fixes C1), add morphing voice button +
   `controlsForState` pure fn, status pill, progress visibility (M5), SVG icons, focus trap, new API
   (`setControls`, `setStrings`, `setOpen`, ...), all strings via `strings`/textContent (M4).
3. `create-call-center.js`: accept `locale`/`strings`, `prepared` flag, smart `voice` handler,
   `setControls` after every state change, `setLocale`/`setStrings`, response guard (C2), action
   try/catch via registry (H5), `stt.stop()` null guard (M1), `getUserMedia` ordering (H3).
4. `api.js`: export the six new i18n symbols (L6/§2.5).
5. Add JSDoc to all exports (H1). Tighten STT prepare retry/degradation (H2).
</content>
</invoke>
