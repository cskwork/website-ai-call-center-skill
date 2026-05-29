# Deep Research: 다도메인 노코드 AI 콜센터 플랫폼으로의 진화

작성일 2026-05-29. 방법: 5개 각도로 웹 검색 fan-out → 24개 소스 fetch → 109개 주장 추출 → 상위 25개를 클레임당 3표 적대적 검증(2/3 기각 시 탈락) → 12개 확정. 이 문서는 **확정/기각/미검증**을 명확히 구분한다. 기각·미검증 주장은 의사결정 근거로 쓰지 말 것.

연구 질문: 현재의 브라우저/WASM·CPU-only·최소 인프라 AI 콜센터 오버레이(브라우저 오버레이 + 로컬 YAML 시나리오 엔진[키워드 매칭] + Transformers.js WASM STT + Piper WASM TTS + 선택적 HTTP AI 어댑터)를, 비개발자가 쓰는 노코드 어드민(그래프+폼)을 갖춘 다도메인(금융/교육/보험/기술지원) 플랫폼으로 어떻게 키울 것인가. **하드 제약: 필수 GPU·무거운 백엔드 없이 CPU/WASM 브라우저에서 동작.**

---

## 1. 핵심 결론 (TL;DR)

기술적으로 실현 가능하다. 단, 두 가지 경계를 지켜야 한다.

1. **아키텍처는 "빌더(client) ↔ 실행 엔진(client)" 분리**로 간다 — Voiceflow가 쓰는 산업 표준 패턴. 단 Voiceflow의 실행 런타임 자체는 Node 전용이라 클라이언트로 포팅 불가 → **실행 엔진은 기존 YAML 엔진을 자체 확장**해서 만든다.
2. **음성 + 경량 의도분류 + 임베딩은 진짜로 CPU/WASM 브라우저에서 돈다** (Transformers.js, sherpa-onnx로 입증). 클라우드가 꼭 필요한 유일한 부분은 무거운 LLM 어댑터 — 이미 optional HTTP adapter로 설계돼 있어 제약과 잘 맞는다.
3. **규제 도메인(특히 보험)은 플로우 빌더만으로 불충분** — 테넌트별 written governance 문서와 대화 중 AI 사용 고지(disclosure)를 1급 제품 기능으로 넣어야 한다. "데이터가 브라우저에 머무는" 구조는 PII엔 유리하나 고지 의무를 없애주지는 않는다.

---

## 2. 확정된 발견 (검증 통과)

### A. 아키텍처 / 빌드-바이 경계

**[확정·3-0] 빌더와 실행 엔진을 분리하는 것이 표준이고 올바른 목표 아키텍처.**
Voiceflow runtime README: 런타임은 "프로그램을 읽어 사용자 입력에 따라 실행하는 CPU 같은 것"이며, 디자이너는 "IDE처럼 비주얼 프로그래밍 언어로 작성"하고 "플로우 다이어그램이 프로그램으로 컴파일"된다. 런타임은 userID로 이전 상태를 가져와 노드를 돌며 상태를 갱신하고 턴마다 저장한다.
출처: https://github.com/voiceflow/runtime

**[확정·3-0] Voiceflow식 실행 엔진은 Node/서버 전용이라 클라이언트/WASM으로 그대로 못 쓴다.**
`@voiceflow/runtime` package.json은 CommonJS Node(main=build/index.js), browser/module 필드 없음, 의존성 `vm2`(Node 내부 vm 모듈, 브라우저 불가)·`workerpool`·`require-from-url`·`form-data` 전부 Node 전용. `runtime-client-js`는 원격 호스팅 런타임을 부르는 얇은 클라이언트일 뿐(이미 archived). **→ 결론: 서드파티 런타임 포팅이 아니라 기존 로컬 YAML 엔진을 클라이언트 실행용으로 확장하라.**
출처: https://github.com/voiceflow/runtime

**[확정·3-0] 빌더 프론트엔드는 React Flow(@xyflow/react) 위에 짓는다.**
MIT 라이선스, 클라이언트 사이드, 노드 드래그·줌·팬·다중선택·요소 추가/삭제가 기본 제공. 캔버스 원시기능을 재구현할 필요 없이 커스텀 도메인 노드 + 폼 기반 설정 패널에 집중 가능. 현재 패키지는 @xyflow/react v12. (단 "기본 제공"은 합리적 디폴트일 뿐, 스타일링·커스텀 노드 타입은 직접 작업 필요.)
출처: https://reactflow.dev/, https://reactflow.dev/learn/concepts/the-viewport

**[확정·3-0] 다도메인 = 산업별 프리빌트 템플릿 전략(검증된 시장 패턴).**
Voiceflow는 Finance, Insurance, Healthcare, Real Estate, E-commerce, Restaurants, Travel, Law Firms 템플릿을 명시 제공. (이 주장은 "템플릿 전략"에 한정 — 이 템플릿들이 클라이언트/CPU/WASM에서 돈다는 주장은 아님.)
출처: https://www.voiceflow.com/templates

### B. CPU/WASM 음성·ML 실현 가능성 (하드 제약 충족 여부)

**[확정·3-0] 콜센터에 필요한 전체 음성 파이프라인(STT + TTS + audio-classification)이 서버 없이 브라우저에서 동작 — Transformers.js(ONNX Runtime 사용).**
HF 문서: "서버 없이 브라우저에서 바로 Transformers 실행." 오디오 카테고리에 ASR·TTS·audio-classification 포함. v2.7.0부터 브라우저 내 TTS(SpeechT5), STT는 Whisper.
주의: "서버 없음"=추론 서버 없음. 모델 가중치는 CDN/HF Hub에서 최초 1회 다운로드 후 캐시. 비-ONNX 모델은 Optimum 변환 필요, 브라우저 TTS 모델 선택지 제한적, CPU 지연시간 편차 있음.
출처: https://huggingface.co/docs/transformers.js/index, https://github.com/huggingface/transformers.js

**[확정·3-0] CPU/WASM이 기본값이고 WebGPU는 명시적 opt-in → no-GPU 제약 직접 충족.**
HF 문서 그대로: "브라우저에서 실행 시 기본적으로 모델은 CPU(WASM)에서 돈다. GPU(WebGPU)로 돌리려면 device:'webgpu' 설정." v3도 CPU/WASM 기본, WebGPU는 브라우저 불안정성 때문에 off. **→ 함의: 경량 의도분류(text/zero-shot-classification)와 RAG 임베딩(feature-extraction, sentence-similarity)도 백엔드 없이 브라우저에서 가능. 무거운 LLM 경로만 클라우드 필요.**
출처: https://huggingface.co/docs/transformers.js/index

**[확정·3-0] 대안/보완 음성 스택 sherpa-onnx: STT·TTS·화자분리·VAD를 인터넷 없이 로컬 실행, CPU 가능(임베디드/RPi/Cortex-A7).**
주의: 기능들은 하나의 번들이 아니라 별도 모델/파이프라인. "전 플랫폼 CPU-only"라는 더 센 주장은 **기각**(아래 §4)됐으니 "CPU 지원은 플랫폼별로 잘 입증됨" 수준으로 받아들일 것.
출처: https://github.com/k2-fsa/sherpa-onnx

**[확정·3-0] sherpa-onnx는 WebAssembly/브라우저를 명시 지원**(실시간 中+英 Zipformer STT, Piper 기반 WASM TTS). 기존 Transformers.js + Piper 스택과 나란히 쓸 수 있는 브라우저/WASM 빌딩블록.
주의(CPU-only 재확인): WASM 빌드는 **싱글스레드 CPU**, 멀티스레딩은 Node.js 애드온에서만.
출처: https://github.com/k2-fsa/sherpa-onnx, https://k2-fsa.github.io/sherpa/onnx/wasm/index.html

### C. 규제 / 컴플라이언스 (보험 도메인만 검증 통과)

**[확정·2-1] 보험을 다루려면 플로우 빌더 이상이 필요 — NAIC Model Bulletin은 인가 보험사가 AI 시스템에 대해 written governance program(AIS Program)을 개발·구현·유지하길 기대.**
플랫폼은 테넌트별 written governance 문서, 감사/기록 보존, 컴플라이언스 문서화 기능을 지원해야 한다.
뉘앙스(반대 1표): bulletin은 "must"가 아니라 "should/expected to" — 주별 채택(2025년 기준 ~24개 주)에 따른 사실상 의무이지 자기집행 법률 아님. **별도로 "벤더가 보험사의 전체 컴플라이언스 부담을 자동 상속"한다는 주장은 기각(0-3)** — 벤더가 자동으로 다 떠안는다고 가정하지 말 것.
출처: https://content.naic.org/sites/default/files/cmte-h-big-data-artificial-intelligence-wg-ai-model-bulletin.pdf.pdf

**[확정·3-0] 보험 오버레이는 대화/UX 층에서 AI 사용 고지를 구현해야 한다.**
NAIC Sec.1.9: AIS Program은 "영향받는 소비자에게 AI 시스템 사용 사실을 고지하고, 보험 생애주기 단계에 맞는 정보 접근을 제공하는 절차"를 포함해야 함. 클라이언트/프라이버시 구조는 PII 처리엔 유리하나 적극적 소비자 고지 의무를 없애지 않는다. **→ 빌더에 테넌트/관할별로 첫 상호작용 시 표시되는 1급 AI-disclosure 노드/배너가 필요.**
출처: 위 NAIC PDF (Kennedys 2025, Holland & Knight 2025 보강)

---

## 3. 이 프로젝트에 대한 권고 (빌드 vs 바이)

### 직접 만든다 (BUILD)
- **클라이언트 실행 엔진**: 기존 로컬 YAML 시나리오 엔진을 상태 기반(턴마다 상태 갱신/저장) 클라이언트 실행기로 확장. 서드파티 런타임 포팅 ❌.
- **빌더 프론트**: React Flow(MIT) 노드 그래프 + 폼 설정 패널(하이브리드 = 사용자 요청과 일치). 도메인 노드 타입과 검증을 커스텀.
- **산업 템플릿 팩**: 금융/교육/보험/기술지원 프리빌트 시나리오 템플릿(Voiceflow 패턴 차용).
- **컴플라이언스 표면**: 테넌트별 governance 문서 + 설정형 AI-disclosure 노드/배너.

### 재사용한다 (BUY/오픈소스, 모두 CPU/WASM·MIT 계열)
- **Transformers.js** — STT/TTS + 온디바이스 의도분류·임베딩(RAG). 단일·활발히 유지되는 라이브러리로 음성+ML 다수 커버.
- **sherpa-onnx** — 대안/보완 브라우저 음성 스택(STT/TTS/VAD/화자분리), 오프라인.
- **Piper** — 이미 사용 중인 WASM TTS, 유지.
- **React Flow** — 빌더 캔버스.

### 클라우드가 필요한 유일한 부분
- 무거운 LLM 어댑터(생성형 응답). 이미 optional HTTP adapter로 설계돼 제약과 정합. 핸드오프/멀티테넌시는 thin optional backend가 필요할 수 있음(미검증, §5).

---

## 4. 주의 / 기각된 주장 (근거로 쓰지 말 것)

- **[기각·0-3]** 벤더가 보험 AI 라이프사이클/감사 의무를 자동 상속하고 컴플라이언스를 완전히 떠안는다 — 거짓. 의무는 1차적으로 보험사(테넌트)에.
- **[기각·0-1]** sherpa-onnx가 "전 주요 플랫폼에서 CPU-only" — 과장. CPU 지원은 플랫폼별.
- **[기각/기권]** Moonshine 관련 주장들(STT 온디바이스, intent/TTS/diarization 번들, 26MB Tiny 등) — 검증 불충분, 확정 근거로 쓰지 말 것.
- **[기권·0-0]** EU AI Act Article 50(챗봇 AI 고지), 미국 통화 녹취 동의법(연방 1-party, 주별 all-party: MD/WA/CA/MA 등) — **초안은 있으나 검증 미통과 → 미확정.** "통화 녹취가 없는(no-telephony)" 제약 덕에 녹취 동의법 리스크는 낮으나, 브라우저 내 오디오 캡처가 동의/AI-고지 규칙을 건드릴 수 있음.
- 모델 가중치는 최초 1회 네트워크 다운로드 필요("서버 없음"=추론 서버 없음, 첫 로드 시 네트워크 0 아님).
- NAIC 채택은 주별로 계속 확대 중(2025 ~24개 주 → 2026 초 과반) — 규제 표면이 아직 넓어지는 중.

---

## 5. 추가 리서치 필요 (이번에 검증 미통과한 공백)

1. **경쟁사 상세**: Vapi/Retell/Synthflow/Bland/Botpress의 가격 모델·무료/셀프호스트 티어·파이프라인의 클라우드/GPU 의존도 vs 클라이언트 가능 범위 — Voiceflow만 검증 통과. 전용 1차자료 조사 필요.
2. **도메인 무관 config/스키마 설계**: 의도 분류체계, slot/entity 모델, RAG 문서 바인딩, 테넌트별 오버라이드. 어떤 경량 온디바이스 분류기(소형 ONNX intent, 문장 임베딩 유사도)가 백엔드 LLM 없이 키워드 매칭을 대체할 만큼 정확한가.
3. **비보험 도메인 컴플라이언스 확정**: FERPA(교육), PCI-DSS·금융자문 규칙(금융), GDPR/EU AI Act Art.50, 관할별 브라우저 오디오 캡처 동의 — 그리고 data-stays-in-browser 구조가 각 의무를 실제로 얼마나 줄여주는지(또는 못 줄이는지).
4. **핸드오프 & 멀티테넌시 vs 최소 인프라**: 에스컬레이션/테넌트 격리를 thin optional backend로 달성 가능한가, 아니면 필수 서버를 강제해 bare-infra 목표를 깨는가.

---

## 6. 출처 (1차자료 우선)

확정 발견은 전부 1차자료(벤더 문서·공식 repo·NAIC PDF) 기반:
- https://github.com/voiceflow/runtime (런타임 아키텍처·Node 전용 입증)
- https://reactflow.dev/ , https://reactflow.dev/learn/concepts/the-viewport (빌더 프론트)
- https://www.voiceflow.com/templates (산업 템플릿 전략)
- https://huggingface.co/docs/transformers.js/index , https://github.com/huggingface/transformers.js (브라우저 STT/TTS, CPU/WASM 기본값)
- https://github.com/k2-fsa/sherpa-onnx , https://k2-fsa.github.io/sherpa/onnx/wasm/index.html (오프라인·WASM 음성 스택)
- https://content.naic.org/sites/default/files/cmte-h-big-data-artificial-intelligence-wg-ai-model-bulletin.pdf.pdf (보험 governance·AI 고지)

참고(검증 미통과/블로그 등급, 맥락용): retellai.com·typebot.io·deepgram.com·sensory.com·justia.com·artificialintelligenceact.eu·edusageai.com·n8n docs·moonshine repo.

통계: 5개 각도 · 24 소스 fetch · 109 주장 추출 · 25 검증 · 12 확정 · 13 기각.

---

# Round 2 — 미검증 공백 재조사 (2026-05-29)

방법: 6각도 · 30 소스 fetch · 129 주장 추출 · 25 검증 · **24 확정 / 1 기각**. 1차 확정 사항은 전제로 두고 검증 미통과 공백만 조준. 사용자 우선순위 ①(온디바이스 의도분류)·②(config 스키마)에서 구체적 권장안 도출.

## A. 온디바이스 의도분류 (① — 명확한 권장안 도출)

**티어형 권장 (3단계 전부 브라우저 CPU/WASM):**

1. **디폴트(학습데이터 불필요): `Xenova/all-MiniLM-L6-v2` 임베딩 유사도** `[3-0]`
   384-dim, mean-pool + normalize, Transformers.js feature-extraction, ONNX Runtime/WASM. **int8 ONNX ~23MB**(풀precision 90.4MB). 키워드 매칭을 직접 대체하는 경량 베이스라인. 폴백: `device: navigator.gpu ? 'webgpu' : 'wasm'`.
   출처: huggingface.co/Xenova/all-MiniLM-L6-v2 (+ /tree/main/onnx), sentence-transformers/all-MiniLM-L6-v2

2. **업그레이드(라벨 데이터 있을 때): SetFit / FastFit 분류기 헤드** `[3-0]`
   소형 fine-tuned가 LLM in-context보다 정확 + 저비용: **FastFit 88.6% vs Flan-ul2 80.1% vs Llama-2-70B-chat 59.0%**(5-shot, FewMany). SetFit은 prompt/verbalizer 불필요, 파라미터 수 자릿수 적음. 학습은 오프라인, **결과 ONNX 아티팩트만 클라이언트에서 실행**.
   주의: 소형 인코더는 OOS(out-of-scope) 검출이 약함 — EMNLP 2024(Amazon) 연구는 hybrid SetFit+LLM router로 native LLM 2% 이내 도달. 즉 단독 소형 모델이 프로덕션 OOS를 완전히 대체 못할 수 있음.
   출처: arXiv 2404.12365(FastFit), arXiv 2209.11055(SetFit), huggingface.co/blog/setfit

3. **Zero-shot NLI (`MoritzLaurer/deberta-v3-*-zeroshot`)**: **거친 라우팅 / cold-start 전용** `[3-0]`
   장점: 새 의도를 라벨 문자열만 편집해 추가(학습 데이터 0, NLI entailment 기반, `hypothesis_template='This text is about {}'`). xsmall은 edge/in-browser용 명시(142MB).
   한계 정량화 `[2-1/3-0]`: fine-grained 분류에 약함 — Banking77에서 xsmall **0.627**, base-v2.0 **0.421**(72클래스) vs fine-tuned **~92-94%**.

**설계 함의:** 임베딩 유사도 = 기본 의도 해석기 / zero-shot NLI = 새 도메인 cold-start(라벨 전) / SetFit = 라벨 쌓이면 정확도 업그레이드.

**기각·미정량:** FastFit "~1ms vs LLM >1s(1000x)" 지연 주장 `[0-3]` — **인용 금지**. 브라우저 CPU/WASM 실제 추론 지연 수치는 이번에도 확정 못함(open).

## B. 도메인 무관 config 스키마 (② — Rasa + React Flow 모델로 구체화)

- **Rasa 선언형 domain 모델이 검증된 청사진** `[2-1]`: domain = responses/actions/slots/session config의 운영 "universe"(선언형 YAML, 코드 아님). 단 NLU/stories/rules/policies는 별도 파일 → domain이 문자 그대로 "전체"는 아님. slot은 재사용 가능한 typed K-V **패턴**이지 plug-and-play 아님.
- **slot/entity 모델** `[3-0]`: 정확히 **6개 타입**(text/bool/categorical/float/any/list). 형태 `slot: {type, initial_value, mappings:[{type}], validation:{rejections:[{if, utter}]}}`. NLU→slot 바인딩은 선언형 **데이터**(`from_entity`/`from_intent` + conditions). 클라이언트 실행기로 직렬화 가능.
  주의: rejection `if` 조건은 Rasa의 pypred 예측 라이브러리 사용 → **클라이언트 실행기가 조건 평가를 재구현해야 함**(스키마 형태는 이식 가능, 평가 의미론은 turnkey 아님).
  출처: rasa.com/docs (domain, slots)
- **Flows-as-data** `[3-0]`: React Flow는 `ReactFlowJsonObject = {nodes, edges, viewport}` 3필드 JSON으로 직렬화 → DB 저장/재로드 라운드트립(`toObject()`+`JSON.stringify` 저장, `JSON.parse`+`setNodes/setEdges/setViewport` 복원). **최상위 형태는 고정 — 도메인 페이로드(의도/프롬프트/slot 바인딩)는 각 `node.data` 필드에 담는다.**
  출처: reactflow.dev (react-flow-json-object, save-and-restore)

**설계 함의:** 빌더는 그래프를 `{nodes,edges,viewport}`로 저장하되 각 `node.data`에 Rasa식 선언형 의도/slot/응답 설정을 넣는다. 클라이언트 실행기가 이 JSON을 재해석. 단 조건 평가 로직은 자체 구현.

## C. 부분 확정

- **경쟁사** `[3-0, 부분]`: Botpress v12는 오픈소스(AGPLv3 듀얼라이선스)·self-hostable(OS 바이너리/Docker/소스), Botpress Cloud 불필요. 단 **v12는 sunset된 레거시 OSS 라인**(현 Botpress Cloud는 다른 모델). Vapi/Retell/Synthflow/Bland 가격·파이프라인, Botpress NLU/flow 아키텍처는 또 검증 미통과.
- **컴플라이언스** `[3-0, 부분]`: **EU AI Act Article 50(1)** — 자연인과 직접 상호작용하는 AI는 사용자가 AI와 상호작용 중임을 알도록 설계해야 함(2026.8.2 적용, 늦어도 첫 상호작용 시 고지). 1차 보험 NAIC 고지와 합쳐 **AI 고지는 관할 교차 반복 의무 — 데이터 로컬리티가 고지 의무를 면제하지 않음.**
  출처: artificialintelligenceact.eu/article/50

## D. 이번에도 미해결 (3차 리서치 또는 설계 단계로)

자료는 fetch됐으나(FERPA studentprivacy.ed.gov, PCI basistheory, ESMA 금융자문 AI, EDPB VVA 가이드라인, Chatwoot, Cloudflare Durable Objects 등) 적대적 검증 통과 주장이 없어 confirmed에서 제외 — **미확정으로 취급**:

1. **핸드오프 + 멀티테넌시 (완전 미해결)**: 라이브 에이전트 에스컬레이션·테넌트 격리가 thin/serverless/edge backend로 가능한지 vs 상시 서버 강제인지. (Chatwoot·Rasa handoff·Cloudflare Durable Objects 자료 확보됨.)
2. **브라우저 CPU/WASM 의도 추론 지연**: "1000x" 기각 후 정량 수치 없음. ~200M DeBERTa-base가 브라우저에서 인터랙티브한지 미확인.
3. **비EU/비보험 컴플라이언스**: FERPA, PCI-DSS + 금융자문 적합성, GDPR 적법근거, 관할별 브라우저 마이크 캡처 동의 — 그리고 data-stays-in-browser가 각 의무를 실제로 줄여주는지.
4. **경쟁사 가격·클라우드/GPU 의존도**: Vapi/Retell/Synthflow/Bland.

통계(2차): 6각도 · 30 소스 fetch · 129 주장 추출 · 25 검증 · 24 확정 · 1 기각.

---

# Round 3 — 다국어 임베딩 / 핸드오프·멀티테넌시 / 비EU 컴플라이언스 (2026-05-29)

방법: 5각도 · 26 소스 fetch · 120 주장 추출 · 25 검증 · **24 확정 / 1 기각**. P1 실측을 전제로 진행. 가장 중요한 미해결(핸드오프/멀티테넌시)이 해소됨.

## A. 다국어 온디바이스 임베딩 모델 (① 후속 — 모델 선정)

- **`Xenova/multilingual-e5-small`** `[3-0]`: Transformers.js **1st-party ONNX**(int8 ~118MB), 384-dim, 50+ langs(KO 포함). 라이브러리 저자(Joshua Lochner) 직접 변환. **검증된-가용 최강 디폴트.** 단 입력에 `query: ` 프리픽스 필요.
- `Alibaba-NLP/gte-multilingual-base` `[3-0 specs / 2-1 no-ONNX]`: 305M, 768-dim, 8192토큰, 70+ langs, 동급 SOTA(MIRACL 62.1, mGTE EMNLP 2024). 단 공식 repo는 ONNX 없음 → 서드파티 `onnx-community` 미러 필요. CPU/WASM엔 무겁다(768-dim/305M).
- `paraphrase-multilingual-MiniLM-L12-v2`(P1 우승) `[3-0]`: 384-dim, 50 langs(KO 포함), ~118M. 컴팩트 대안.
- (참고 소스) `su-park/mteb_ko_leaderboard` — 한국어 MTEB 리더보드.

**P1.5 헤드투헤드 실측**(`scripts/bench-intent.mjs`, e5 `query:` 프리픽스 지원 추가, EN+KO 합집합 프로토타입):

| 모델(int8) | 콜드 | 웜 중앙값 | 정확도 | 점수 특성 |
|---|---|---|---|---|
| all-MiniLM-L6-v2 | 7.4s | 11.1ms | 4/6 | 영어 전용, KO 실패(0.13) |
| paraphrase-multilingual-MiniLM-L12-v2 | 20.9s | 17.1ms | 6/6 | 진단 0.59, KO 0.98 |
| **multilingual-e5-small** | 23.1s | 21.1ms | **6/6** | **진단 0.91 등 분리도 우수** |

**결정: `multilingual-e5-small`을 임베딩 디폴트로 권장** — 1st-party ONNX + 6/6 + 점수 분리도 우수(진단 0.908 vs MiniLM 0.588)로 임계값/OOS 견고. 비용 웜 ~21ms(인터랙티브), `query:` 프리픽스 필수. MiniLM-L12-v2는 프리픽스 불필요 대안. (소표본 6 쿼리 — 방향성.)

## B. 핸드오프 + 멀티테넌시 — Round 2 R5 해소 `[3-0]`

- **Cloudflare Durable Objects**: 단일 DO가 수천 WebSocket 클라이언트의 서버; **Hibernatable WebSockets → 유휴 중 GB-s(duration) 과금 없음**(핸드오프 조정점이 상시 서버로 과금되지 않음). `idFromName()`으로 테넌트/대화별 결정적 격리(고유 인스턴스 + 자체 영속 스토리지).
- **PartyKit**(오픈소스, Cloudflare 2024 인수): DO 기반 엣지 멀티플레이어 WebSocket 룸(~50ms 도달, 거의 0 startup, 상태 보존).
- **Chatwoot**: 봇→상담원 핸드오프 = 대화 status `pending→open` API 1콜. **Rasa**: `pattern_human_handoff` 훅(상담원 데스크 백엔드 없음, 연결 로직은 구현자 몫; CALM/Pro 기능).
- **결론: 정적 클라이언트 디폴트 제품이 상시 서버 없이 옵션 라이브 핸드오프를 추가 가능** — 엣지 WebSocket(DO/PartyKit) 또는 셀프호스트 Chatwoot status-change. **최소 서버 컴포넌트 = 테넌트/대화당 DO 1개.** 제약: DO ~1k req/s soft limit, 1GB/object, 요청/스토리지는 별도 과금.

## C. 비보험 컴플라이언스 `[3-0, 부분]`

- **금융(FINRA Notice 24-09 + ESMA)**: **기술 중립** — 사내/벤더/임베디드 무관하게 회원사(member firm)에 의무 귀속. **클라이언트 사이드가 의무를 떠넘기지 않는다.** SEC predictive-data-analytics 제안(S7-12-23)은 **2025.6 철회 → 비구속**(추후 신규 제안 가능). 주의: "scope는 use이지 hosting 아님"이라는 1차자료 주장은 **0-3 기각** — 클라이언트가 scope를 줄인다고 1차자료로 주장하지 말 것. 단 기술중립 원칙은 FINRA/ESMA로 독립 지지.
- **FERPA(교육)**: school-official 예외 = 벤더가 (1)학교가 직원으로 수행할 기능을 수행 **AND** (2)교육기록 사용/유지에 학교의 직접 통제 하 — **계약 의무**(누적 조건, 99.33(a) 재공개 제한 등 추가). 데이터 브라우저 잔류는 통제·최소사용 입증에 도움되나 계약 요건을 제거하지 않음.

## D. 이번에도 미해결 (전 라운드 누적)

- **경쟁사 가격/클라우드 의존도**(Vapi/Retell/Synthflow/Bland) — 3라운드 연속 검증 미통과(가격 페이지 변동 + 엄격 검증). `github.com/botpress/nlu`(별도 오픈소스 NLU repo) 존재하나 주장 미생존. → 1차자료 직접 확인 필요(설계엔 비핵심).
- **PCI-DSS scope**(카드데이터 미수집 시 범위 제외 여부), **GDPR controller/processor + 온디바이스 동의** — 미생존. → 도메인 go-live 전 법무.
- **P1 지연 독립 공개수치 교차검증** — 미생존. 내 직접 측정으로 대체(외부 코로보레이션 없음). 참고: `do-me.github.io/SemanticFinder`(브라우저 시맨틱 검색 데모).

통계(3차): 5각도 · 26 소스 fetch · 120 주장 추출 · 25 검증 · 24 확정 · 1 기각.
