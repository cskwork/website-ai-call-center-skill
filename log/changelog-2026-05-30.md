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
