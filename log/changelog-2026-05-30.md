# Changelog 2026-05-30 — P3 no-code admin builder (MVP vertical slice)

PRD 로드맵 P3. 비개발자가 React Flow 캔버스 + 폼으로 대화 흐름을 만들고, P2b 런타임
`createFlowEngine`이 그대로 실행하는 config-bundle(v2) JSON을 export한다. *what*은 코드에, *why*는 여기.

워크플로우 오케스트레이션(설계 2 병렬 → 단일 writer 구현 → 적대적 검증 3 병렬 → 수정)으로 구현.

## 범위 — MVP 수직 슬라이스

핵심 신규성은 **그래프 에디터**. 의도적으로 좁힌 슬라이스:
- 캔버스(8개 노드 종류 커스텀 노드 + 드래그/연결/선택), 노드 팔레트, 인스펙터 폼(노드 `data` + 엣지 라우팅), 메타데이터 폼.
- 순수 직렬화/검증 lib + import/export + Ajv 검증.

보류(빌드 안 함, 한계로 명시): 산업 템플릿 팩(P4), 백엔드/테넌트 영속화, 라이브 양방향 핸드오프,
조건 비주얼 빌더(raw JSON textarea로 충분), undo/redo·멀티선택, 테마 폴리시, Playwright 스모크.

## 아키텍처 — 왜 분리·왜 별도 앱

- **별도 `admin/` 앱(자체 `package.json`).** React + `@xyflow/react` 12 + Ajv를 SDK가 아니라 admin에만 둠 → SDK의 "no new runtime deps" 보존. SDK `files`에 admin 미포함. Vite 8 + React 19 + `@vitejs/plugin-react` 6 호환 확인(190→ 빌드 OK).
- **순수 lib(`admin/src/lib/`)와 React 컴포넌트 분리.** 직렬화/검증/노드레지스트리는 프레임워크 무관 모듈로, `node --test`로 단위 검증. JSX는 빌드 컴파일로만 검증(node --test는 JSX 미렌더). 이 분리가 핵심 — 핵심 계약을 브라우저 없이 보증.
- **엔진 필드 매핑을 `src/engine/flow-engine.js` 소비 지점과 라인 단위로 교차검증.** 8개 노드 종류의 편집 가능 `data` 필드가 런타임이 실제로 읽는 것과 일치(node.type AND data.type 양쪽 기록 → `nodeKind()`와 React Flow 렌더 동기화).
- **Ajv `$ref` 해석.** config-bundle이 call-scenario를 절대 `$id`로 `$ref` → 두 스키마 모두 `addSchema` 후 compile(SDK `tests/config-bundle.test.mjs` idiom 동형). 비개발자용 friendly `{path,message}` 에러.

## 적대적 검증이 잡은 통합 버그 (핵심) — critical + high

- **조건 엣지가 raw 문자열로 직렬화 → 엔진이 항상 true.** 인스펙터 textarea가 `edge.data.condition`을
  JSON **문자열**로 저장. 엔진 `evaluateCondition`은 `typeof expr !== 'object'`이면 `Boolean(expr)` 반환 →
  비어있지 않은 문자열은 항상 truthy → **조건 라우팅이 무력화**(작성한 조건과 무관하게 그 엣지가 항상 선택).
  리뷰어가 실제 `createFlowEngine`(`src/api.js`)로 end-to-end 재현: false여야 할 조건이 true 분기로 라우팅됨.
  스키마는 `flowEdge.additionalProperties:true`라 Ajv는 통과 → "어드민은 받아들이나 엔진이 작성대로 못 돈다"는
  바로 그 실패. 수정: **직렬화 경계(`flow-bundle.js` `parseCondition`)에서 문자열을 엔진 표현식 객체로 파싱**,
  객체는 verbatim 통과(재export 라운드트립), 불가파싱 JSON은 friendly Error로 export 차단. 인스펙터는 객체 조건을
  `JSON.stringify`로 렌더(import된 객체가 `[object Object]`로 깨지지 않게). 회귀 테스트(`condition-edge.test.mjs`):
  false 조건은 기본 엣지로 falls through, true 조건만 분기.

## 추가 수정 — medium + low(정직성)

- **빈 엣지 모드 = 죽은 엣지(medium).** 모드만 고르고 값을 비우면 `data.intent===''`가 intent 엣지로 분류되나
  어떤 의도와도 불일치 + 기본 엣지도 아님 → 영구 도달불가. 수정: export 시 공백 intent/condition을 strip →
  엔진 기본/fallback 엣지로 안전 degrade.
- **import 파일 크기 가드(low, 메인 루프 추가).** `readJsonFile`에 5MB 상한 추가 — 구현 요약이 "huge JSON cannot
  crash"라 단언했으나 미구현이었음. 단일 사용자 클라이언트 SPA라 blast radius는 사실상 0이나 주장과 코드 일치화.

## 의도적 한계(코드 변경 없음, 기록)

- **intent-branch fallback은 EN 문자열만 편집 가능.** 엔진 `branchFallback`은 `{en,ko}` 객체도 읽으나 인스펙터는
  string 폼만 노출(message 노드는 `i18n.ko.text` 노출). ko 분기 fallback은 후속(P3.1) 또는 P4에서.
- **캔버스 노드 요약 텍스트 미절단(cosmetic).** 긴 단일행 텍스트가 노드를 늘릴 수 있음. React text child라
  injection 안전. CSS overflow로 후속 정리.

## 검증 (메인 루프 독립 실행)

- `npm test --prefix admin` **24/24**(순수 lib 라운드트립 + 런타임필드 strip + validate valid/invalid + `$ref`
  해석 + 불변성 + nested-data + **엔진 라운드트립**: export 번들이 실제 `createFlowEngine`을 구동 — 의도매칭/fallback/ko).
- `npm run build --prefix admin` ok(275 모듈; 비치명 500kB chunk 권고만).
- 루트 `npm test` **81/81**(SDK 무회귀 — `src/`·`schemas/`·`bundles/` 미변경, admin은 스키마 read + 테스트에서
  `src/api.js` import만).
- `admin/src/lib/`에 react/@xyflow import 없음(프레임워크 무관 확인). XSS 없음(`dangerouslySetInnerHTML` 부재,
  전 텍스트 React children), import JSON은 사용 전 검증, 네트워크/시크릿/텔레메트리 없음.

## 다음

P4(산업 템플릿 팩) 또는 P3.1(어드민 폴리시: ko fallback, 텍스트 절단, Playwright 스모크). 어드민 export가 P2b 엔진을
구동함이 테스트로 증명됨 → 빌더↔런타임 계약 확립.

---

# P4 — 산업 템플릿 팩 (finance/education/insurance) + 엔진 스모크

PRD 로드맵 P4. 비개발자가 즉시 시작할 수 있는 도메인별 프리빌트 config-bundle(v2) 3종 추가. 각 번들은 P2b
`createFlowEngine`이 그대로 실행하고, P3 어드민이 불러올 수 있는 시작점. support(기존)까지 4개 도메인.

워크플로우(설계 → 도메인 3개 **병렬 작성**(독립 파일) → 통합 테스트/와이어링 → 적대적 검증 3 병렬 → 수정).

## 산출물
- `bundles/{finance,education,insurance}.bundle.json` — 각 4 의도/시나리오, EN+KO 이중언어, disclosure+governance,
  비어있지 않은 flow(start → ai-disclosure → intent-branch → message/action → handoff → end), condition-object 엣지 1개.
- `tests/templates.test.mjs` — bundles/*.bundle.json 전수 Ajv 검증 + intent↔scenario 와이어링 + 도메인별 엔진 스모크
  (의도 라우팅/고지 1회/escalation handoff/gibberish→clarification) + **EN+KO 발화 parity 전수 검사**.
- `scripts/validate.mjs` requiredFiles()에 3개 번들 경로 추가.

## 결정과 근거
- **병렬 작성이 자연스러운 fan-out.** 3 도메인 번들은 독립 파일 → 에이전트별 1파일 작성(충돌 0). 통합/테스트만 단일 writer.
- **콘텐츠는 예시 스캐폴드, 법적 조언 아님.** governance.notes에 "Replace all copy... before production" 명시, tenant.name에
  "(Template)". 날조된 규제/가격/계좌/컴플라이언스 주장·PII 없음. 고지는 EN+KO로 AI 사용 명시(PRD §7 기조).
- **gold reference(support 번들) 형태 그대로 미러링** + 양 스키마 준수. 키워드 분류는 `union(EN, KO)` keywords로 동작하므로
  스모크/parity 테스트가 결정론적.

## 적대적 검증이 잡은 결함 → 수정 (medium 3)
- **교육 번들의 광고 발화 2개가 자기 의도로 분류 실패** (`When are my lectures`, `I need to speak with a person`가
  자기 keywords와 토큰 불일치 → null). 키워드 보강(lecture/person/speak).
- **EN+KO 발화 parity 갭** (finance KO `오늘 영업하나요`가 keyword `영업점`의 substring 아님 → null). `영업` stem 추가.
  → `tests/templates.test.mjs`에 **모든 광고 발화가 자기 의도로 분류됨**을 전수 단언하는 parity 테스트로 고정.
- **dead default-edge → 미매칭 입력이 clarification 없이 핸드오프로 직행.** intent-branch에 `data.fallback`을 뒀지만
  no-data 기본 엣지가 n-handoff로 가서 fallback이 unreachable + off-topic 입력이 사람에게 직행(인력 낭비). 3 번들 모두
  기본 엣지 제거 → 미매칭 시 `pickEdge`가 null 반환 → branchStep이 fallback 발화 후 대기(self-serve UX). 회귀 테스트 추가.

## 의도적 한계 (low, 기록)
- 템플릿은 8 노드종류 중 7개 사용(slot-fill 미사용). `topic` slot의 from_intent 매핑은 graph 모드에서 slot-fill 노드 없이는
  안 채워짐 → 현재는 스키마 형태 예시(inert). 필요 시 slot-fill 노드 추가가 후속.

## 검증 (메인 루프 독립 실행)
- 루트 `node --test tests/*.test.mjs` **93/93** (81 + 신규 12).
- `npm run validate` ok — **build-bundle --check 그린**(support.bundle.json·SDK src/·schemas/·build-bundle.mjs 불변 = P0/P2b 무회귀).
- admin `npm test --prefix admin` **24/24** 무회귀.
- 정리 필요: 작성 검증용 throwaway `tmp-kw.mjs`/`tmp-verify-insurance.mjs`가 루트에 남음(샌드박스 rm 차단). untracked·미참조라
  커밋에서 선택적 staging으로 제외. 수동 삭제 권장.

---

# Full e2e 브라우저 검증 + Codex 교차 리뷰

전체 스택을 실제 브라우저(headless Chromium, Playwright)로 검증하고, dev 브랜치 전체를 Codex CLI(`codex exec review --base main`)로
교차 리뷰. *why*는 여기.

## 신규 e2e 표면
- `scripts/flow-e2e-smoke.mjs`(`npm run smoke:flow`) + `examples/flow-template/` — **새 멀티도메인 스택의 풀스택 e2e 갭을 닫음**.
  기존 browser-smoke는 구 local-rule-engine 경로만 탔음 → P2b flow-engine + P4 템플릿 + 오버레이를 빌드된 SDK로 브라우저에서 통째로 구동
  (finance EN: 조건-객체 엣지→action+handoff / finance KO: 이중언어 고지+메시지 / insurance EN: 동일 엔진 다른 템플릿). 예제는
  멀티도메인 엔진 사용법 문서 역할 겸함.
- `admin/scripts/admin-smoke.mjs`(`npm run smoke --prefix admin`) — 빌드된 어드민 SPA를 브라우저에서 렌더→노드 추가→export, 그리고
  **다운로드 번들이 config-bundle 스키마 통과**까지 검증.

검증 스위트(7): 루트 `npm test`(94) · admin `npm test`(25) · `validate` · `smoke:browser` · `smoke:site` · `smoke:flow` · admin smoke — 전부 ok.

## Codex 교차 리뷰가 잡은 P2(medium) 2건 → 수정
- **터미널 노드 후 그래프 세션 정지(blank).** `end` 노드 도달 시 `currentNodeId=null`이 세션에 영속 → 같은 세션의 다음 입력이 빈 응답.
  수정: `runGraph` 진입 시 `currentNodeId==null`이면 start 노드로 재진입 → 한 주제 완료 후 다음 질문이 새 traversal로 라우팅(고지는
  `disclosed` latch로 재노출 안 됨). 회귀 테스트 추가(`flow-engine.test.mjs`). 종전엔 disclosure-once 테스트가 turn2 blank라 vacuously
  통과했었음 → 이제 실제 재라우팅을 단언.
- **어드민 import 시 `node.type` 미수화.** `data.type`만 있고 top-level `type` 없는(스키마상 유효, 런타임은 `data.type ?? type` 읽음)
  번들을 import하면 React Flow가 기본 노드로 렌더 + 인스펙터 필드 없음. 수정: `bundleToFlow`가 import 시 `type ??= data.type` 수화.
  회귀 테스트 추가(`admin/test/flow-bundle.test.mjs`).

재검증: 위 7 게이트 모두 재실행 그린(dist/admin dist 재빌드 후 스모크 포함).

---

# P5 — 컴플라이언스 표면 (강제 계약 + 문서)

PRD 로드맵 P5(G5). 메커니즘(AI 고지 노드·governance 블록)은 P2b/P4에서 이미 구현됨 → 남은 일은 **강제 계약화 + 문서화**. *why*는 여기.

## 결정과 근거
- **컴플라이언스를 옵셔널 스키마가 아니라 강제 계약으로.** governance/disclosure는 스키마상 optional(유연성 유지). 하지만 **출하되는 모든
  번들**(bundles/*.bundle.json)은 이를 반드시 갖춰야 한다는 계약을 `tests/compliance.test.mjs`로 강제: (1) 완전한 governance 블록
  (owner/modelVersions/lastReviewed YYYY-MM-DD/notes), (2) bilingual disclosure(required:true, showOn 유효, text.en+ko), (3) 실제
  `createFlowEngine` 구동으로 **고지가 첫 상호작용에 1회 렌더되고 이후 반복되지 않음**을 단언. 템플릿이 둘 중 하나라도 빠뜨리면 테스트 실패.
- **컴플라이언스 문서는 privacy와 분리.** `docs/privacy.md`는 데이터 잔류/캐시 모델 → 고지·거버넌스 규제 표면은 신규 `docs/compliance.md`로.
  핵심 뉘앙스 명시: 고지는 NAIC·EU AI Act Art.50 교차관할 의무이며 **클라이언트 사이드 데이터 잔류로 면제되지 않음**; governance 블록은
  written-governance를 **문서로** 충족(플랫폼이 테넌트 전 책임 상속 안 함); 금융 기술중립(FINRA/ESMA), 교육 FERPA 계약통제, PCI/GDPR/마이크
  동의는 go-live 전 법무 게이트. **법적 조언 아님 + 템플릿은 예시**임을 명시.
- 발견성: README의 "before production use" 문서 목록에 `docs/compliance.md` 추가. `scripts/validate.mjs`에 compliance.md 내용 가드 추가
  (privacy.md 가드 패턴 동형).

## 검증
- 루트 `npm test` **97/97**(신규 컴플라이언스 3). `npm run validate` ok(compliance.md 가드 포함). admin 무영향.

P5로 PRD 로드맵의 번호 단계는 사실상 완료(P6 핸드오프/멀티테넌트는 명시적 deferred — 스파이크 후 별도 PRD). 후속 후보: P3.1 어드민 폴리시
(ko 분기 fallback, slot-fill 노드, 텍스트 절단), P6 스파이크.

---

# G3 — 임베딩 의도 해석기 (opt-in, 기존 seam)

PRD 목표 G3. P1에서 지연/이중언어/모델만 벤치(`bench-intent.mjs`)로 확정했던 임베딩 분류를, 이제 **런타임 해석기**로 구현.
키워드 해석기와 동일한 `prepare`/`classify` 계약 뒤에 붙어 `createFlowEngine({intentResolver})`로 주입된다. *why*는 여기.

워크플로우(단일 writer TDD 구현 → 적대적 검증 4 병렬 → 조건부 수정). 검증 결과 verified-clean(blocking 0).

## 산출물
- `src/intent/embedding-resolver.js` — `createEmbeddingIntentResolver({model, dtype, prefix?, loadExtractor?})`. 의도별
  프로토타입(EN+KO 합집합 발화)에 대한 **MAX 코사인**으로 점수. 코사인=정규화 벡터의 내적이라 점수 0..1. reduce 초기값
  `{intent:null, score:0}`(키워드 미러) → 전부 비양수면 null. 반환 형태는 키워드 해석기와 바이트 동일.
- `tests/embedding-resolver.test.mjs` — 오프라인 결정론 테스트(가짜 `loadExtractor` 주입, 네트워크 0). 계약/argmax,
  e5 `query: ` 프리픽스 on/off, 프로토타입 캐싱(임베드 호출 횟수 단언), EN+KO 합집합, 빈 intents/빈 발화 가드,
  불변성, prepare 멱등(prepare+classify 레이스에서 1회 로드), 진행 콜백 전달 + flow-engine 통합 2건(매칭 라우팅/임계값 미만 거부).
- `src/api.js`·`tests/contracts.test.mjs` — export 추가.

## 결정과 근거
- **새 런타임 dep 0.** `@huggingface/transformers`는 이미 STT/TTS용 dependency. 기본 로더에서만 **lazy 동적 `import()`**
  → 무다운로드 keyword 기본 경로는 transformers를 절대 끌어오지 않음(정적 호스트·오프라인 보존). 임베딩은 엄격히 opt-in.
- **테스트 가능성 = 주입 seam.** `loadExtractor`로 추출기를 주입 가능 → 단위 테스트는 모델 다운로드 없이(콜드 7~22s 회피)
  결정론적 가짜 임베딩으로 계약/캐싱/프리픽스를 전수 검증. 기본 로더만 실제 Transformers.js를 만지며 `bench-intent.mjs`의
  검증된 경로(pooling:'mean'/normalize:true/numThreads=1/feature-extraction)와 동형.
- **기본값은 PRD §4 채택.** model=`Xenova/multilingual-e5-small`, dtype=int8, e5 프리픽스 자동(`/e5/i` 매칭 시 `query: `).
  flow-engine 수용 로직(`score>0 && score>=minScore`, threshold 기본 0.45)과 점수 스케일(0..1) 자연 호환.

## 적대적 검증 → 메인 루프 수정 (medium 1 + low 1)
- **캐시 키 충돌(medium).** `intentsCacheKey`가 구분자 없는 join이라 서로 다른 intent 집합이 같은 키로 매핑 가능
  → 단일 슬롯 캐시가 다른 집합의 프로토타입을 잘못 서빙할 잠재 트랩(출하 경로는 단일 안정 집합 재사용이라 저확률).
  수정: **길이 접두 인코딩**(`${len}:${value}`)으로 id/발화 내용·구분자·빈 문자열 무관하게 충돌 불가.
- **음수 코사인 0 플로어링(low, 투명성).** `maxCosine`가 음수 유사도를 0으로 바닥처리(0..1 보장 + 키워드 비음수 미러).
  flow-engine엔 무해(어차피 거부). JSDoc에 명시.
- low 2건(numThreads=1 고정, e5 모델 id)은 정적 호스트 제약상 의도된 동작 + override 가능 → 유지.

## 의도적 한계 (기록)
- zeroshot/setfit 해석기는 동일 seam 위에 미구현(PRD §4 티어). 실모델 정확도/지연은 `bench:intent`가 별도 검증(네트워크 필요, npm test 제외).
- 기본 로더는 모듈 전역 `env`를 변경(프로세스 전체 single-thread 강제) — 정적 호스트 기본으론 옳음; 멀티스레드 opt-in은 후속 옵션화 여지.

## 검증 (메인 루프 독립 실행)
- 루트 `npm test` **109/109**(이전 97 + 신규 12). `npm run validate` ok. `npm run build` ok(ESM/IIFE+workers).
- `console.log`(src/) 0, 이모지 0, 제어문자 0, 파일 147줄(<800)·전 함수 소형. keyword 기본 경로 무회귀(transformers 미로드).
