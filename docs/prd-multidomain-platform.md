# PRD & 아키텍처 — 다도메인 노코드 AI 콜센터 플랫폼

작성일 2026-05-29. 근거: `docs/research-multidomain-platform-2026-05-29.md`(2라운드 deep-research, 확정 발견에 `[R1]`/`[R2]` 표기). 현재 코드(`src/`, `schemas/`, `scenarios/`)를 수술적으로 확장하는 설계.

설계 원칙은 1차 연구의 핵심 경계를 따른다: **빌더(authoring)와 실행 엔진(execution)을 분리**하되, 실행 엔진은 서드파티 포팅이 아니라 기존 `local-rule-engine`을 확장해 클라이언트에서 돌린다 `[R1]`. 모든 신규 ML은 CPU/WASM 기본, 다운로드는 lazy·opt-in이어서 정적 호스팅(GitHub Pages)에서도 텍스트 경로는 무다운로드로 동작한다.

---

## 1. 개요

### 1.1 비전
하나의 클라이언트 사이드 SDK + 노코드 어드민으로, 비개발자가 금융·교육·보험·기술지원 등 어떤 도메인이든 AI 콜센터/기술지원 봇을 만들고 운영한다. 음성은 브라우저 WASM 유지, 필수 GPU·상시 백엔드 없음.

### 1.2 목표 (v1)
- G1. **도메인 무관 config 스키마**: 코드 수정 없이 도메인을 바꾼다(config-as-data).
- G2. **노코드 어드민**: React Flow 그래프 + 폼 패널로 비개발자가 대화 흐름을 만든다 `[R2]`.
- G3. **의도 해석 업그레이드**: 키워드 매칭 → 브라우저 임베딩 의도분류로 정확도 상승, 무다운로드 폴백 유지 `[R2]`.
- G4. **산업 템플릿 팩**: 금융/교육/보험/기술지원 프리빌트 번들 `[R1]`.
- G5. **컴플라이언스 1급화**: AI 사용 고지 노드 + 테넌트 거버넌스 메타데이터 `[R1][R2]`.

### 1.3 비목표 (v1 제외 — §9·§11)
- 실제 전화망(Twilio/SIP) 연동. (현 제약: 브라우저 WASM 음성 유지)
- 상시 서버형 멀티테넌트 SaaS·라이브 상담원 핸드오프 백엔드. (연구 미해결 → 스파이크 후 결정)
- 무거운 생성형 LLM을 필수 경로로 두는 것. (기존 optional HTTP adapter로 선택 연결만)

---

## 2. 시스템 구성

```
[ 노코드 어드민 (별도 React SPA) ]      authoring 타임, 빌드 타임
  React Flow 캔버스 + 폼 패널
  └─ export ─▶  config bundle (JSON)  ◀─ 산업 템플릿 팩
                       │ 정적 아티팩트(서버 불필요) 또는 optional 백엔드 저장
                       ▼
[ 런타임 SDK (기존 vanilla JS, 프레임워크 독립) ]   런타임, 브라우저
  createWebsiteCallCenter
   ├─ IntentResolver (pluggable)  ── keyword | embedding(all-MiniLM) | zero-shot | setfit
   ├─ FlowEngine     (local-rule-engine 확장: 노드 실행 + slot 상태)
   ├─ STT/TTS adapters (기존 WASM)
   ├─ SafeActionRegistry (기존)
   └─ (optional) HttpEngineAdapter ── 무거운 LLM/RAG가 필요할 때만
```

핵심 분리: **어드민은 config JSON만 생산한다. SDK 안에서 돌지 않는다.** 덕분에 런타임 SDK는 최소·프레임워크 독립을 유지하고, 어드민은 정적 SPA로 배포 가능(서버 0).

---

## 3. 데이터 모델 — Config Bundle 스키마 v2 (G1, 핵심)

기존 `call-scenario.schema.json`은 플랫 단일 시나리오다. v2는 그 위에 **번들** 개념을 얹는다. 기존 시나리오 필드는 보존(back-compat)하고, 시나리오는 의도 분류체계와 플로우 노드가 참조하는 단위가 된다.

레이어(머지 순서): **도메인 팩(템플릿) → 테넌트 오버라이드 → 인스턴스 설정**. Rasa의 선언형 domain 모델을 청사진으로 삼되 `[R2]`, 우리 런타임에 맞춰 단순화한다.

```jsonc
// config-bundle.schema.json (신규, draft 2020-12)
{
  "schemaVersion": "2",
  "tenant": { "id": "acme-bank", "name": "Acme Bank", "locales": ["ko","en"] },
  "domain": "finance",            // finance | education | insurance | support | custom
  "governance": {                 // §8 — NAIC written-governance 문서화 [R1]
    "owner": "compliance@acme",
    "modelVersions": { "intent": "all-MiniLM-L6-v2-int8", "llm": null },
    "lastReviewed": "2026-05-29",
    "notes": "AIS Program ref: ..."
  },
  "disclosure": {                 // §8 — AI 고지 [R1][R2]
    "required": true,
    "showOn": "first-interaction",
    "text": { "ko": "AI 상담원과 대화 중입니다.", "en": "You are speaking with an AI." }
  },
  "intentModel": {                // §5
    "resolver": "embedding",      // keyword | embedding | zeroshot | setfit
    "threshold": 0.45,            // 미만이면 fallback/handoff
    "model": "Xenova/all-MiniLM-L6-v2", "dtype": "int8"
  },
  "slots": {                      // §6 — Rasa식 typed K-V [R2]
    "account_no": { "type": "text", "mappings": [{ "type": "from_entity", "entity": "account_no" }] },
    "verified":   { "type": "bool", "initial_value": false }
  },
  "intents": [                    // 의도 분류체계 + 대표 발화(임베딩 프로토타입)
    { "id": "balance_inquiry", "utterances": ["잔액 알려줘","what's my balance"], "scenario": "balance" }
  ],
  "scenarios": [ /* 기존 call-scenario 스키마 그대로 (reply/frontend_actions/workflow/i18n) */ ],
  "flow": {                       // §7 — React Flow 직렬화 형태 [R2]
    "nodes": [ /* { id, type, position, data:{...} } */ ],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "rag": {                        // 선택 — 온디바이스 임베딩 검색 또는 백엔드 위임
    "mode": "client",             // client(브라우저 임베딩) | backend(HTTP adapter) | off
    "documents": [ { "id": "faq-1", "text": "..." } ]
  }
}
```

설계 결정:
- **flow 최상위는 React Flow 고정 형태(`nodes/edges/viewport`)**, 도메인 페이로드는 전부 `node.data`에 담는다 `[R2]`. 이로써 어드민 저장/복원이 라운드트립된다.
- **시나리오는 보존**: 기존 빌드 파이프라인(`build-scenarios.mjs`)과 i18n.ko 로컬라이즈를 그대로 재사용. v2 번들은 시나리오 배열을 감싸는 상위 구조일 뿐.
- **검증은 Ajv**(이미 devDependency)로 빌드·런타임 양쪽에서.

---

## 4. 의도 해석기 인터페이스 (G3, §3.intentModel 구현)

기존 stt/tts/engine과 동일한 pluggable adapter 철학. 신규 계약:

```js
// IntentResolver
prepare(onProgress)                         // lazy 모델 로드 (keyword는 no-op)
classify(text, { locale, intents })         // → { intent, score, scores: [{intent,score}] }
```

티어(연구 권장 `[R2]`):

| 구현 | 모델/크기 | 다운로드 | 용도 | 비고 |
|---|---|---|---|---|
| `createKeywordIntentResolver` | 없음 | 0 | **기본/폴백**, 정적 호스팅 | 기존 `selectScenario` 로직 래핑 |
| `createEmbeddingIntentResolver` | **EN/KO 디폴트: multilingual-e5-small** int8 ~118MB(`query:` 프리픽스 필요; 대안 paraphrase-multilingual-MiniLM-L12-v2; 영어 전용이면 all-MiniLM-L6-v2 ~23MB) | lazy | **권장 디폴트 업그레이드** | Transformers.js feature-extraction, cosine vs intent.utterances(EN+KO 합집합), CPU/WASM 기본 |
| `createZeroShotIntentResolver` | DeBERTa-v3 zeroshot xsmall ~142MB | lazy | 새 도메인 cold-start(라벨 전), coarse 라우팅 | 새 의도=라벨 문자열. fine-grained 약함 |
| `createSetFitIntentResolver` | 테넌트 학습 ONNX 헤드 | lazy | 라벨 쌓이면 정확도 업그레이드 | 학습은 오프라인, ONNX만 클라이언트 |

규칙:
- 디폴트는 **keyword**(무다운로드, 오프라인, 정적). `intentModel.resolver`로만 임베딩 활성화 → 최소 인프라 제약 유지.
- `score < threshold` → fallback 시나리오, 누적 미해결 시 handoff(§9).
- **OOS(out-of-scope) 검출은 소형 모델 약점** `[R2]` → 신뢰도 임계값 + 키워드 폴백 + 핸드오프로 방어. 단독 소형 모델로 프로덕션 OOS를 완전히 대체한다고 가정하지 않는다.
- ✅ **지연 실측 완료(P1 스파이크, `scripts/bench-intent.mjs`)**: 헤드리스 Chromium, CPU/WASM 싱글스레드에서 웜 추론 **중앙값 11~18ms**(인터랙티브), 콜드 로드 7~22s(모델 다운로드+init, 1회성). R1 리스크 해소. → 임베딩은 lazy·opt-in 업그레이드(진행 표시), keyword는 무다운로드 디폴트 유지.
- ✅ **이중언어 결정(P1)**: all-MiniLM-L6-v2는 영어 전용이라 KO 0/2 실패. **EN/KO 제품은 다국어 모델 + EN+KO 합집합 프로토타입**이 필수 → 6/6. `intents[].utterances`는 키워드 `unionTerms`처럼 EN+KO 합집합으로 채운다(P2에서 마이그레이션 갱신).
- ✅ **임베딩 디폴트 = `multilingual-e5-small`(P1.5 헤드투헤드)**: e5-small과 MiniLM-L12-v2 모두 6/6이나 e5-small이 (a) Transformers.js 1st-party ONNX, (b) 점수 분리도 우수(진단 0.91 vs 0.59 → 임계값/OOS 견고), 웜 ~21ms. `query:` 프리픽스 필수. MiniLM-L12-v2는 프리픽스 불필요 대안.

---

## 5. 플로우 실행 엔진 (G1, `local-rule-engine` 확장)

`createLocalRuleEngine`를 깨지 않고, 같은 어댑터 계약(`startSession`/`sendUserText`/`endSession`)을 만족하는 `createFlowEngine`을 추가한다. 키워드 전용 모드는 기존 엔진으로 계속 동작(back-compat).

세션 상태: `{ sessionId, currentNodeId, slots }`. `sendUserText`:
1. IntentResolver로 의도 분류
2. 현재 노드의 out-edge 중 조건/의도 매칭으로 다음 노드 선택
3. 노드 실행 → `{ text, actions, scenarioId, slots, handoff? }` 반환

노드 타입(`node.data.type`):
- `message` — reply 텍스트(+i18n)
- `intent-branch` — 의도별 분기
- `slot-fill` — 엔티티→slot 채움(Rasa `from_entity`/`from_intent` 매핑) `[R2]`
- `action` — SafeActionRegistry id 실행(기존)
- `ai-disclosure` — 고지 표시(§8)
- `handoff` — 상담원/티켓 라우팅(§9)
- `http-call` — optional HttpEngineAdapter 위임(LLM/RAG/백엔드)
- `end`

설계 결정 — **조건 평가는 자체 구현** `[R2]`: Rasa의 rejection 조건은 Python pypred 라이브러리라 이식 불가. `eval` 없이 안전한 소형 JSON 표현식 평가기(`{ "==": ["slot.verified", true] }` 형태)를 만든다. 보안: 임의 코드 실행 경로 없음(기존 "등록된 action만 실행" 원칙 계승).

---

## 6. 노코드 어드민 빌더 (G2, 별도 React SPA)

`admin/` 신규 디렉터리(런타임 SDK와 분리 빌드). 스택: React + `@xyflow/react`(MIT) `[R2]`.

기능:
- **캔버스**: React Flow 노드 그래프 — 드래그/줌/팬/다중선택 기본 제공 `[R2]`. 커스텀 노드 타입 = §5 노드 타입.
- **폼 패널**: 노드 선택 시 우측 폼에서 `node.data` 편집(의도, 응답 텍스트, slot 바인딩, action id, 고지 문구). "그래프+폼" 하이브리드 = 사용자 요청.
- **검증**: Ajv로 config-bundle 스키마 실시간 검증, 비개발자용 친화 에러 메시지.
- **템플릿(G4)**: 금융/교육/보험/기술지원 프리빌트 번들에서 시작 `[R1]`. "새로 만들기"는 빈 캔버스.
- **버전관리**: `ReactFlowJsonObject` 스냅샷 저장(`toObject()`+`JSON.stringify`) / 복원(`setNodes/setEdges/setViewport`) `[R2]`.
- **export**: config bundle JSON 다운로드.

배포 모델(v1, 최소 인프라):
- 어드민은 정적 SPA. export한 JSON을 `scenarios/`처럼 저장소에 커밋하거나 정적 자산으로 호스팅 → **서버 0**, 기존 YAML→build 흐름과 동형.
- (선택) 테넌트별 동적 저장은 §9의 optional 백엔드로 — v1 비목표.

---

## 7. 컴플라이언스 표면 (G5)

연구 확정: AI 고지는 보험(NAIC) `[R1]`과 EU(AI Act Art.50, 2026.8.2 적용) `[R2]` 모두에서 반복되는 **관할 교차 의무**이며, 데이터가 브라우저에 머물러도 **고지 의무는 면제되지 않는다**.

- **`ai-disclosure` 노드 + `disclosure` 전역 설정**: 첫 상호작용 시 테넌트/관할별 문구 표시. 음성 모드에선 TTS로도 고지.
- **`governance` 메타데이터 블록**: 소유자·모델 버전·검토일·AIS Program 참조 — NAIC written-governance를 **문서로** 충족(플랫폼이 보험사의 전 책임을 상속하지는 않음 — 1라운드 기각 사항 주의).
- **프라이버시 포스처**: 텍스트/음성이 기본적으로 브라우저를 떠나지 않음(HTTP adapter 미사용 시). PII 처리엔 유리 — 단 면책 아님. `docs/privacy.md`에 명시.
- **금융 도메인은 기술 중립**(Round 3 `[R3]`): FINRA Notice 24-09 + ESMA는 사내/벤더/임베디드 무관하게 회원사에 의무 귀속 → **클라이언트 사이드가 규제 의무를 면제하지 않는다.** SEC predictive-data-analytics 제안은 2025.6 철회(비구속). "데이터가 브라우저에 머문다"를 컴플라이언스 면책으로 마케팅하지 말 것.
- **교육(FERPA)**(Round 3 `[R3]`): school-official 예외는 벤더가 (1)학교가 직원으로 할 기능 수행 AND (2)교육기록에 학교 직접 통제 하 — **계약 의무**. 클라이언트 구조는 통제 입증에 도움되나 계약 요건을 제거하지 않음.
- ⚠️ **PCI-DSS scope·GDPR controller/processor·마이크 캡처 동의는 여전히 미확정** → 도메인 go-live 전 법무 검토 필요(§10 R3).

---

## 8. 멀티테넌시 & 핸드오프 (범위 한정)

Round 3에서 **해소** `[R3]`: 상시 서버 없이 엣지/서버리스로 가능함이 확인됨. 단계적·비파괴적으로:
- **v1(정적)**: "멀티테넌시 = 서로 다른 config 번들 배포". 테넌트당 JSON 하나. 서버 불필요.
- **핸드오프 v1(thin)**: `handoff` 노드가 설정된 webhook/email/티켓 URL 또는 셀프호스트 Chatwoot의 status `pending→open` API로 라우팅(fire-and-forget).
- **라이브 양방향 핸드오프(v2, 옵션)**: **Cloudflare Durable Objects**(Hibernatable WebSockets → 유휴 중 duration 과금 없음, `idFromName()`으로 테넌트/대화별 격리) 또는 **PartyKit**으로. **최소 서버 컴포넌트 = 테넌트/대화당 DO 1개** — 상시 서버 아님, 정적 디폴트 비파괴. 제약: DO ~1k req/s, 1GB/object.

---

## 9. 단계별 로드맵 (각 단계 검증 포함)

| Phase | 산출물 | 검증 |
|---|---|---|
| **P0. 스키마 v2** | `schemas/config-bundle.schema.json` + Ajv 검증 + 기존 시나리오 래핑 | `npm run validate` 통과, 기존 4개 시나리오 무손실 마이그레이션 |
| **P1. 임베딩 의도분류** | `createEmbeddingIntentResolver` (opt-in) + 지연 벤치마크 스파이크 | 단위테스트(의도 정확도), 브라우저 CPU 지연 측정, keyword 폴백 유지 확인 |
| **P2a. 번들 엔진** ✅ | `createFlowEngine` + pluggable IntentResolver(keyword) + slot 상태 + 첫 턴 AI 고지 + handoff 신호 | `node --test`(11), 어댑터 계약 호환, build ok |
| **P2b. 그래프 실행(deferred)** | 노드 그래프 실행 + 안전 조건 평가기 + slot `from_entity` | P3 authoring과 결합(실행할 플로우가 생긴 뒤) |
| **P3. 노코드 어드민** | `admin/` React Flow SPA + 폼 + Ajv 검증 + export | export JSON이 P0 스키마 통과, 라운드트립 저장/복원 |
| **P4. 산업 템플릿** | finance/education/insurance/support 번들 | 각 템플릿이 스키마 통과 + smoke 시나리오 |
| **P5. 컴플라이언스** | disclosure 노드 + governance 블록 + privacy 문서 | 고지 노드 첫 상호작용 렌더 테스트, 문서 리뷰 |
| **P6(deferred). 핸드오프/멀티테넌트** | 스파이크 → 설계 → optional 백엔드 | 별도 PRD, 정적 디폴트 비파괴 확인 |

원칙: 각 Phase는 독립 PR. 기존 `npm test / build / site:build / smoke:*` 그린 유지(commandment 9).

---

## 10. 리스크 & 오픈 질문 (연구 caveat 직결)

- **R1. 임베딩 지연 — 해소됨(P1)**: 웜 11~18ms/쿼리(CPU/WASM 싱글스레드), 콜드 7~22s. 인터랙티브 확인 → 임베딩 lazy·opt-in 업그레이드 채택, keyword 무다운로드 디폴트 유지. 새 발견: 영어 전용 모델은 KO 실패 → 이중언어엔 다국어 모델+합집합 프로토타입 필수.
- **R2. OOS 검출 약함** `[R2]`: 임계값+키워드 폴백+핸드오프로 방어. 필요 시 hybrid(소형+optional LLM router).
- **R3. 컴플라이언스 — 부분 해소(Round 3)**: 금융은 기술 중립(클라이언트≠면제), FERPA는 계약 통제 필요. **PCI-DSS scope·GDPR controller/processor·마이크 캡처 동의는 미확정** → 도메인 go-live 전 법무 게이트.
- **R4. 조건 평가 이식 불가** `[R2]`: Rasa pypred 대신 자체 안전 평가기(eval 금지).
- **R5. 핸드오프/멀티테넌트 — 해소(Round 3)**: 상시 서버 불필요. 옵션 라이브 핸드오프는 엣지(Cloudflare DO hibernatable / PartyKit) 또는 셀프호스트 Chatwoot로. 최소 서버 = 대화당 DO 1개. 정적 디폴트 비파괴.
- **R6. 모델 최초 다운로드 네트워크 필요** `[R1]`: "서버 없음"=추론 서버 없음. 첫 로드 캐시(OPFS) 후 오프라인. 텍스트 경로는 무다운로드.

남은 미해결: 경쟁사 가격·클라우드 의존도(3라운드 연속 미통과 — 설계 비핵심), PCI-DSS scope·GDPR 온디바이스 역할·마이크 동의(법무 게이트), e5-small vs MiniLM-L12-v2 정식 벤치(P1.5는 6쿼리 방향성).

---

## 11. 변경 영향 요약 (현 코드 기준)

- 신규: `schemas/config-bundle.schema.json`, `src/intent/*` (resolver들), `src/engine/flow-engine.js`, `src/engine/condition.js`, `admin/`(별도 앱), 템플릿 번들.
- 확장(비파괴): `src/index.js` export 추가, `create-call-center.js`에 IntentResolver 주입 옵션, `build-scenarios.mjs`가 번들도 검증.
- 보존: 기존 `local-rule-engine`, stt/tts/safe-actions/i18n/overlay, 정적 호스팅 텍스트 경로.
