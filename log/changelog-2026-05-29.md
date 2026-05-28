# Changelog 2026-05-29 — i18n, state-driven overlay redesign, design + quality pass

Integration of three parallel implementer bundles (SDK, scenarios, landing) against the
authoritative contract in `log/redesign-spec-2026-05-29.md`. This entry records the key decisions
and the reasoning (the *why*); the *what* lives in the code and the spec.

## Outcome

All six verification steps pass from repo root, in order:

1. `node scripts/build-scenarios.mjs` — regenerates `site/generated/scenarios.js`
2. `npm test` — 36 tests pass + `validate` (schema + stale-check) ok
3. `npm run build` — ESM/IIFE + worker bundles
4. `npm run site:build` — scenarios + bundles + `build-pages: ok`
5. `npm run smoke:site` — `site-smoke: ok`
6. `npm run smoke:browser` — `browser-smoke: ok` (loads `examples/vanilla` + `examples/esm-smoke`)

No new runtime dependencies, no emoji, no `console.log` in shipped `src/`/`site/`, backward-compatible
SDK API, `examples/vanilla` unchanged.

## i18n architecture — why plain frozen maps, EN-default + field-level fallback

- **No i18n library.** The repo is vanilla ESM with a hard "no new deps" constraint. Localization is
  two frozen string maps (`UI_STRINGS.en` / `.ko` in `src/i18n/ui-strings.js`; `LANDING_STRINGS.en` /
  `.ko` in `site/i18n.js`). A library would add weight and a build step for ~140 keys.
- **English is always the fallback.** `resolveLocale` normalizes BCP-47-ish tags
  (`'ko-KR'` -> `'ko'`, region-trimmed, case-insensitive) and returns `'en'` for anything unknown.
  `createUiStrings(locale, overrides)` deep-merges `EN <- locale <- overrides` and deep-freezes the
  result. Partial KO translations can never produce a blank UI — missing keys silently inherit EN.
  This keeps the system safe as KO copy evolves.
- **Pure, immutable string builders.** `createUiStrings` never mutates the shared source maps
  (covered by a regression test), so the same `UI_STRINGS` can back every center instance.
- **Backward compatibility preserved.** `locale` and `strings` are optional; with neither set,
  behavior is byte-for-byte the previous English. `options.title`, when present, still overrides the
  localized title (caller-localized title wins). `examples/vanilla/main.js` needs no edits.
- **Locale-agnostic scenario matching (deliberate split of concern).** Keyword matching must work
  regardless of UI language — a Korean user can be on an English page and vice versa. So `terms` is
  the deduped **union** of EN + KO `match.keywords`, while only the *rendered* reply/labels follow the
  active locale. Matching language and display language are intentionally decoupled.
- **Action ids are an interface, labels are presentation.** The scenario build asserts every
  `i18n.ko.frontend_actions[].id` already exists in the EN `frontend_actions` ids and throws a clear
  error otherwise. Translators may localize labels but cannot invent action ids that the host page has
  not registered — this protects the safe-action contract.

## State-driven overlay — why a pure `controlsForState` + closure capture

- **Single source of truth for control visibility.** `controlsForState(state, prepared, strings)` is a
  pure function returning `{ voice, send, stopSpeaking, end }` descriptors. Pulling the
  visibility/label/icon rules out of the DOM render makes them unit-testable
  (`tests/overlay-controls.test.mjs`) without a browser, and guarantees the rendered footer always
  matches the declared rules.
- **Morphing voice button instead of a 5-button row.** The old UI exposed separate Prepare / Voice /
  Stop-listening buttons. The redesign collapses these into one button that morphs by
  `(state, prepared)`: `prepare` (mic-off) -> `start` (mic) -> `stop` (stop, while listening). Fewer
  controls, less cognitive load, matches the approved mock. `stopSpeaking` shows only while `speaking`
  (stops TTS); `end` shows only while a session is active.
- **Closure capture over `this`-binding.** `createOverlay` captures `root`/`els` in closures rather
  than relying on `this.root`. The old `this` pattern was fragile under event-handler rebinding; the
  closure form removes a whole class of `undefined this` bugs.
- **Live language switch is a re-render, not a rebuild.** `setStrings(next, title?)` swaps the static
  labels via `textContent` and then re-runs `setControls(last)` with the last known `{state, prepared}`
  so the status pill and morphing button relabel without tearing down the panel or losing session
  state. The landing `setLocale` rides this path so EN/KO flips live.
- **Security + a11y by construction.** All locale/scenario/user text enters the DOM via `textContent`
  (or escaped attributes for aria-labels); only static SVG/markup uses template strings. Panel is
  `role="dialog" aria-modal="true"` with a Tab/Shift+Tab focus trap, Escape-to-close, focus return to
  the fab, `aria-live="polite"` status + messages, and per-mode `aria-label` on the icon-only voice
  button.

## Design upgrades — why keep the visual language, raise the craft

- **Coherent tokens, not a redesign.** Spacing/type scale unified via CSS custom properties for
  stronger vertical rhythm; cards normalized to consistent radius/shadow/border with hover states; nav
  gained a clear active state; theme + language toggles share a segmented look. The dark/light glass
  aesthetic, gradient glow blobs, and Inter + JetBrains Mono are preserved — the goal was elevation,
  not reinvention, to avoid regressing landing.js hooks and existing animations.
- **Korean renders well in both themes.** Added `Noto Sans KR` to the Google Fonts `<link>` (CDN, not
  a dependency) and a Korean-capable fallback to both font stacks
  (`Inter, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif`) in `src/ui/overlay.css` and
  `site/styles.css`, so KO does not fall back to a mismatched system glyph set.
- **Responsive + reduced-motion.** Mobile nav wrap, hero/demo/scenario-grid stacking, visible focus
  rings, AA contrast in both themes, and `prefers-reduced-motion` honored (static waveform, no
  transitions) so the polish does not cost accessibility.

## Quality refactor — why JSDoc, tightened boundaries, surgical diffs

- **Audit-driven, not speculative.** SDK changes apply findings from `log/audit-sdk.md` and design
  changes from the design audit: JSDoc on every exported function, tightened error handling at the
  engine/STT/TTS adapter boundaries, immutability preserved, functions kept <=50 lines. Internals that
  already worked were left alone to keep the blast radius minimal.
- **Honest diagnostics retained.** Browser capability checks (secure context, WASM, worker, storage,
  microphone) report real pass/warn/fail; no fake success paths were introduced during localization.

## Integration fixes applied (contract reconciliation)

Landing.js still carried hardcoded English in dynamic strings, violating spec §4.3 ("Replace ALL
hardcoded English UI strings with `LANDING_STRINGS[getLocale()]` lookups") and §4.1 (cover status
fallbacks, check messages, demo notes). These would have leaked English into the KO UI at runtime —
not caught by the existing tests because they only fire on live events. Reconciled to the spec:

- Added five keys to both `LANDING_STRINGS.en` and `.ko` in `site/i18n.js`:
  `check-checking`, `check-failed`, `note-progress`, `note-error`, `note-action` (KO + EN parity kept
  at 141 keys each).
- `site/landing.js`: routed the progress / error / action event notes and the check
  `Checking...` / `Check failed.` fallbacks through `s(...)`, and added a small pure `fill(template,
  values)` helper to substitute `{token}` placeholders in the localized templates (consistent with the
  existing `diagnostics-summary` / `ticket-draft-template` token style).

The action-registry `label` strings in `createLandingActions()` were left in English on purpose: they
are internal safe-action identifiers; the overlay renders action buttons from the *scenario's*
localized `actions[].label` (via `getScenarioReply(text, getLocale())`), so no English leaks into the
KO overlay.

No other contract drift found: SDK exports (`createUiStrings`, `resolveLocale`, `UI_STRINGS`,
`UI_LOCALES`, `DEFAULT_LOCALE`, `controlsForState`) and the center's `setLocale`/`setStrings` match the
names landing.js and the scenario layer consume.

## Post-review cleanup (medium-severity findings)

After the adversarial review, five blocking (high) findings were fixed during the workflow's fix phase
(modal focus relocation on control hide, light-theme diagnostic contrast, live-toggle readout state
loss, malformed `rgba()`, inverted `theme-toggle` `aria-pressed`). A follow-up pass then resolved the
medium-severity i18n/accessibility/design findings that fall directly under the "thorough multilingual +
quality" goal:

- **i18n completeness for non-text content.** The skip link and ~13 region `aria-label`s stayed English
  in KO. Added a generic `[data-i18n-aria]` swap to `applyLocale` (sets `aria-label` from a localized
  key, mirroring the existing `[data-i18n]`/`[data-i18n-placeholder]` handling) and annotated the skip
  link (`data-i18n="skip-link"`) plus brand, nav, hero actions, badges, signal, phrase grid, demo
  targets, ticket draft, scenario catalog, architecture diagram, tablist, checklist, and the language
  toggle. `LANDING_STRINGS` parity is now 159/159 keys EN/KO (verified programmatically).
- **Korean hero/heading clipping.** `h1`/`h2` use tight `ch` caps (`11ch`/`14ch`) tuned for Latin text;
  full-width Korean glyphs clipped. Added `html[lang="ko"] h1 { max-width: 22ch }` /
  `h2 { max-width: 26ch }` so KO headings breathe without touching the English design.
- **Dark-theme tertiary contrast.** `--quiet` `#6b7280` measured ~4.0:1 on `--bg #090d16` (below AA
  4.5:1). Raised to `#8b94a8` (~6.3:1) while staying dimmer than `--muted` to preserve hierarchy.

Lower-severity nits (e.g. non-standard `font-weight` 750/850 clamping, mixed indentation in one media
block, optional ARIA `aria-expanded`/roving-tabindex enhancements) were intentionally left as-is to keep
the diff surgical; they do not affect correctness, the EN/KO experience, or AA conformance.

## Independent verification (render, not just build)

Re-ran all six steps from a clean checkout after the cleanup: 36/36 tests, `validate ok`, `build` and
`site:build` exit 0, `smoke:site`/`smoke:browser` ok. Additionally rendered the built `_site` headlessly
in EN and KO: confirmed `<html lang>` flips, nav/skip-link/region aria-labels/scenario catalog localize,
the KO `h1` wraps without clipping, and the overlay opens with exactly two visible controls in the fresh
idle state (`음성 준비` + `보내기`) using SVG icons — confirming the 5-button row is gone.
