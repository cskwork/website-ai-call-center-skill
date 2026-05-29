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

---

## Research + PRD: 다도메인 노코드 플랫폼 방향 (의사결정 기록)

2라운드 deep-research(웹 검색 fan-out → 소스 fetch → 클레임당 3표 적대적 검증) 후 PRD/아키텍처 설계.
*Why*는 여기, *what*은 두 문서에. 산출물:
- `docs/research-multidomain-platform-2026-05-29.md` — R1(24소스/12확정) + R2(30소스/24확정), 확정/기각/미검증 구분.
- `docs/prd-multidomain-platform.md` — config-bundle 스키마 v2, pluggable IntentResolver, FlowEngine, 노코드 어드민, 컴플라이언스 표면, 6단계 로드맵.

핵심 결정과 근거:
- **빌더/실행 엔진 분리하되 엔진은 자체 확장.** Voiceflow 런타임은 Node 전용(vm2 등)이라 클라이언트 포팅 불가 → 기존 `local-rule-engine`을 `flow-engine`으로 확장. 비파괴(어댑터 계약 유지).
- **의도분류 티어화, 디폴트는 keyword 유지.** all-MiniLM-L6-v2 int8(~23MB) 임베딩이 권장 업그레이드지만 브라우저 CPU/WASM 지연이 연구에서 미정량 → opt-in으로 두고 P1에서 벤치마크 후 디폴트 승격 판단. 정적 호스팅 무다운로드 텍스트 경로 보존.
- **조건 평가는 자체 안전 평가기.** Rasa의 pypred는 이식 불가 + `eval` 금지(기존 "등록된 action만 실행" 보안 원칙 계승).
- **컴플라이언스 1급화.** AI 고지는 NAIC(보험)·EU AI Act Art.50 양쪽 반복 의무이고 데이터 로컬리티로 면제 안 됨 → disclosure 노드 + governance 메타데이터.
- **멀티테넌시/라이브 핸드오프는 v1 비목표.** 연구 미해결(상시 서버 강제 가능성) → 정적 디폴트 비파괴 위해 스파이크 후 v2 결정. v1 핸드오프는 webhook fire-and-forget만.

미해결(3차 리서치 후보): 브라우저 추론 지연 실측, 핸드오프/멀티테넌시 최소 서버면, 비EU 컴플라이언스(FERPA/PCI/GDPR/마이크 동의), 경쟁사 가격·의존도.

---

## P0 구현 + P1 벤치마크 스파이크 (다도메인 플랫폼 착수)

PRD 로드맵의 P0·P1을 실행. *what*은 코드/스키마에, *why*는 여기.

### P0 — config-bundle 스키마 v2 + 무손실 마이그레이션 (완료, 검증됨)
신규: `schemas/config-bundle.schema.json`(기존 call-scenario 스키마를 `$ref`로 재사용 — DRY), `scripts/build-bundle.mjs`(scenarios/*.yml → `bundles/support.bundle.json`, `--check` 스테일 가드로 build-scenarios.mjs idiom 따름), `tests/config-bundle.test.mjs`(5 테스트). `package.json`에 `bundle:build` + `validate`에 `build-bundle --check` 추가. `validate.mjs` 구조 가드 갱신.
- 결정: 번들은 기존 시나리오를 **verbatim 보존**(테스트가 `deepEqual`로 무손실 확증). 도메인 무관 레이어(tenant/domain/intentModel/slots/intents/flow/disclosure/governance)를 위에 얹음. flow 최상위는 React Flow 형태(`nodes/edges/viewport`), 페이로드는 `node.data`.
- 검증: `npm test` 41/41(신규 5 포함), `build-scenarios/build-bundle/validate` 모두 ok.

### P1 — 브라우저 CPU/WASM 의도분류 지연 벤치마크 (완료, 실측)
신규: `scripts/bench-intent.mjs`(playwright headless Chromium + Transformers.js CDN, 커밋된 번들의 intents를 프로토타입으로 dogfooding). `npm run bench:intent`. **npm test에는 미포함**(모델 다운로드/네트워크 필요).

측정(EN 4 + KO 2 held-out 쿼리, 소표본 — 방향성):

| 구성 | 콜드 로드 | 웜 중앙값 | 정확도 |
|---|---|---|---|
| all-MiniLM-L6-v2 int8, EN 프로토타입 | 7.4s | 11.1ms | 4/6 (KO 0/2) |
| paraphrase-multilingual-MiniLM-L12-v2 int8, EN 프로토타입 | 21.7s | 17.5ms | 5/6 (KO 1/2) |
| 동 multilingual + **EN+KO 합집합 프로토타입** | 20.9s | 17.1ms | **6/6** |

결론과 근거:
- **R1(지연 미정량) 해소.** 웜 추론 11~18ms/쿼리(CPU/WASM 싱글스레드) → 인터랙티브. 임베딩 의도분류는 브라우저에서 실용적. "1000x" 류 과장 없이 실측.
- **콜드 로드 7~22s(1회성).** → 임베딩은 lazy·opt-in 업그레이드(진행 표시)로, keyword는 무다운로드 디폴트로 둔다(즉답 + 정적 호스팅).
- **이중언어엔 다국어 모델 필수.** all-MiniLM(영어 전용)은 KO 유사도 0.13~0.15로 완전 실패. paraphrase-multilingual로 교체 시 KO 신호 회복. 비용: 콜드 ~2x, 웜 ~1.5x — KO가 핵심이므로 수용.
- **프로토타입도 이중언어.** intents 프로토타입을 EN+KO 합집합으로 채우자 5/6→6/6. 기존 키워드 `unionTerms`(EN+KO)와 동형. → P2에서 `build-bundle.mjs` 마이그레이션이 `intents[].utterances`를 EN+KO 합집합으로 채우도록 갱신(현재는 EN만; bench는 로컬에서 합집합으로 증명).
- 한계: 표본 6개 — 정식 벤치 스위트 아님. 방향성 결론.

PRD 갱신: §4 의도 해석기(다국어 디폴트), R1 리스크 해소.

### Round 3 리서치 + P1.5 모델 헤드투헤드 (종합 검토)
3차 deep-research(26소스/24확정/1기각) + e5 프리픽스 지원 추가한 bench로 임베딩 디폴트 확정. *why*는 여기, 상세는 `docs/research-multidomain-platform-2026-05-29.md` Round 3.

임베딩 헤드투헤드(int8, EN+KO 합집합 프로토타입, 6쿼리 방향성):

| 모델 | 콜드 | 웜 중앙값 | 정확도 | 점수 분리 |
|---|---|---|---|---|
| all-MiniLM-L6-v2 | 7.4s | 11.1ms | 4/6 | 영어 전용 |
| paraphrase-multilingual-MiniLM-L12-v2 | 20.9s | 17.1ms | 6/6 | 진단 0.59 |
| **multilingual-e5-small** (`query:` 프리픽스) | 23.1s | 21.1ms | **6/6** | **진단 0.91** |

종합 결정과 근거:
- **임베딩 디폴트 = `multilingual-e5-small`.** e5-small·MiniLM-L12-v2 모두 6/6이나 e5-small이 Transformers.js 1st-party ONNX + 점수 분리도 우수(임계값/OOS 견고). `query:` 프리픽스 필수(bench에 자동 적용). MiniLM-L12-v2는 프리픽스 불필요 대안. gte-multilingual-base는 더 높은 천장이나 공식 ONNX 없음(서드파티 미러)·768-dim으로 CPU/WASM엔 무거움.
- **핸드오프/멀티테넌시 R5 해소.** Cloudflare Durable Objects(Hibernatable WebSockets → 유휴 과금 0, idFromName 테넌트 격리)/PartyKit/셀프호스트 Chatwoot로 **상시 서버 없이** 옵션 라이브 핸드오프 가능. 최소 서버 = 대화당 DO 1개. v1 정적 디폴트 비파괴. PRD §8/§10 R5 갱신.
- **컴플라이언스 R3 부분 해소.** 금융(FINRA 24-09/ESMA)은 기술 중립 → **클라이언트 사이드가 규제 의무를 면제하지 않음**(마케팅 주의). SEC PDA 제안 2025.6 철회. FERPA school-official은 계약 통제 필요. PCI-DSS scope·GDPR 역할·마이크 동의는 미확정 → go-live 전 법무 게이트. PRD §7/§10 R3 갱신.
- **3라운드 누적 미해결**: 경쟁사 가격(Vapi/Retell/Synthflow/Bland — 가격 페이지 변동으로 적대적 검증 연속 미통과, 설계 비핵심), PCI/GDPR 세부, P1 지연 외부 코로보레이션 없음(직접 측정으로 대체).

검증: `npm test` 그린 유지(번들/스키마 경로 무회귀). bench는 네트워크/모델 다운로드 필요로 test 미포함(`npm run bench:intent`).

### P2a — 번들 기반 flow-engine + pluggable IntentResolver (완료, 검증됨)
신규: `src/intent/keyword-resolver.js`(무다운로드 키워드 IntentResolver), `src/engine/flow-engine.js`(번들 기반 엔진), `tests/flow-engine.test.mjs`(11 테스트). `src/api.js`에 `createFlowEngine`/`createKeywordIntentResolver` export(배럴 `index.js`가 `export *`로 승계), `tests/contracts.test.mjs`·`scripts/validate.mjs` 갱신.

결정과 근거:
- **P2 범위 축소(P2a/P2b 분리).** 플로우 그래프는 아직 authoring(P3) 전이라 빈 상태 → 노드 그래프 실행기를 미리 만드는 건 premature. 그래서 P2a는 **의도→시나리오 루프**(README의 "intent resolver만 교체" 경로를 번들·다국어·slot·고지 인지로 실현)에 집중. 그래프 실행 + 안전 조건 평가기 + `from_entity` slot은 P2b로 미뤄 P3 authoring과 결합.
- **IntentResolver seam = pluggable 어댑터.** 기존 stt/tts/engine 철학과 동형: `prepare()`+`classify(text,{intents})`. 디폴트 keyword(무다운로드). 임베딩/zero-shot/setfit이 같은 계약으로 끼워짐(테스트의 stub 주입으로 seam 검증). 키워드 점수는 길이가중 정수, 수용 규칙 `score>0 && score>=threshold`(임베딩 0..1 임계값과 공존).
- **flow-engine은 기존 어댑터 계약 드롭인.** `startSession/sendUserText/endSession`(+ resolver 지연로드용 `prepare`). 응답에 `{text,actions}`(create-call-center가 소비) + `scenarioId/intent/score/workflow/handoff/slots`(직접 소비자용). `local-rule-engine`은 그대로 보존(back-compat).
- **slot = Rasa식 K-V.** startSession에서 initial_value로 초기화, `from_intent` 매핑 자동 채움(deterministic). `from_entity`는 NER 필요 → P2b.
- **AI 고지 1급화.** 첫 상호작용 시 locale별 disclosure 텍스트를 응답 앞에 1회 prepend(showOn first-interaction/every-session, off면 생략). 컴플라이언스 결정(R3) 코드 반영.
- **조건 평가기 미포함(P2b).** Rasa pypred 이식 불가 → eval 없는 자체 JSON 평가기는 실행할 조건(authored 노드/엣지)이 생기는 P3와 결합.

검증: `npm test` **52/52**(신규 11), `validate` ok, `npm run build` ok(flow-engine/keyword-resolver가 브라우저 ESM/IIFE로 깨끗이 번들). README의 createFlowEngine 문서화는 후속.
