/**
 * Landing-page i18n module.
 * Handles locale resolution, persistence, DOM swapping, and callbacks.
 * Locales: 'en' (default) + 'ko'.
 */

/** @type {Record<string, Record<string, string>>} */
export const LANDING_STRINGS = Object.freeze({
  en: Object.freeze({
    /* skip link + region aria-labels (screen-reader / on-focus) */
    'skip-link': 'Skip to content',
    'aria-brand': 'Website AI Call Center home',
    'aria-nav-primary': 'Primary',
    'aria-hero-actions': 'Primary actions',
    'aria-badges': 'Project highlights',
    'aria-signal': 'Signal preview',
    'aria-phrase-grid': 'Sample support phrases',
    'aria-demo-targets': 'Demo page targets',
    'aria-ticket-draft': 'Support ticket draft',
    'aria-scenario-catalog': 'Call scenario catalog',
    'aria-arch-diagram': 'Architecture diagram',
    'aria-tablist': 'Integration snippets',
    'aria-checklist': 'Runtime checks',
    /* nav */
    'nav-demo': 'Demo',
    'nav-scenarios': 'Scenarios',
    'nav-architecture': 'Architecture',
    'nav-test-path': 'Test path',
    'nav-start': 'Start',
    /* hero */
    'hero-eyebrow': 'Static-site AI support overlay',
    'hero-h1': 'Add a private AI call-center to any website.',
    'hero-subcopy': 'Browser-local STT and TTS. No server, no API key, no Web Speech. Drop one <script> into your static site.',
    'btn-demo': 'Try the live demo',
    'btn-github': 'View on GitHub',
    'badge-client': '100% client-side',
    'badge-wasm': 'WASM',
    'badge-lazy': 'Lazy model load',
    'badge-mit': 'MIT',
    'signal-channel': 'Support channel',
    'model-progress-idle': 'Models stay unloaded until Prepare.',
    'wasm-mode': 'non-threaded WASM mode',
    /* what section */
    'what-eyebrow': 'What it is',
    'what-h2': 'One reusable interaction layer, no app framework required.',
    'feature-dropin-kicker': 'Drop-in',
    'feature-dropin-h3': 'Framework-agnostic',
    'feature-dropin-p': 'Plain HTML. Works in Astro, Next export, Hugo, a CMS page, or a raw index.html.',
    'feature-local-kicker': 'Local-first',
    'feature-local-h3': 'Browser speech stack',
    'feature-local-p': 'Transformers.js onnx-community/distil-small.en q4 for STT and Piper WASM for TTS.',
    'feature-safe-kicker': 'Safe',
    'feature-safe-h3': 'Registered actions only',
    'feature-safe-p': 'The assistant can run only the actions your page registers. No arbitrary scripts or hidden DOM control.',
    /* demo section */
    'demo-eyebrow': 'Live demo',
    'demo-h2': 'Talk to the page, then let the page guide itself.',
    'demo-p': 'This landing page runs the same overlay bundle you ship. Text support works immediately. Voice support uses WASM STT/TTS after you press Prepare.',
    'demo-card-header': 'Try a support phrase',
    'demo-open-full': 'Open full demo',
    'btn-open-overlay': 'Open support overlay',
    'demo-note-default': 'The overlay is mounted from ./dist/website-ai-call-center.iife.js.',
    /* demo targets */
    'target-audio-kicker': 'Audio setup',
    'target-audio-h3': 'Headset and speaker check',
    'target-audio-p': 'Guide users through output device, mute, and browser permission checks.',
    'target-account-kicker': 'Account',
    'target-account-h3': 'Settings and profile path',
    'target-account-p': 'Show the correct panel and prefill a help query without guessing selectors.',
    'target-diagnostics-kicker': 'Diagnostics',
    'target-diagnostics-h3': 'Browser-local checks',
    'diagnostic-copy-default': 'No checks have run yet.',
    'target-ticket-kicker': 'Escalation',
    'target-ticket-h3': 'Support ticket draft',
    'ticket-placeholder': 'A support draft appears here',
    /* scenarios section */
    'scenarios-eyebrow': 'Call scenario catalog',
    'scenarios-h2': 'Manage the call flow from one readable list.',
    'scenarios-p': 'Each card comes from validated scenarios/*.yml: intent, workflow route, sample phrase, match terms, assistant reply, and the safe actions the page may run.',
    /* how section */
    'how-eyebrow': 'How it works',
    'how-h2': 'Speech and guidance stay modular.',
    'flow-01-h3': 'Mic input',
    'flow-01-p': 'User grants microphone access only after a click.',
    'flow-02-h3': 'WASM STT',
    'flow-02-p': 'Transformers.js transcribes through a worker-backed browser model.',
    'flow-03-h3': 'Scenario engine',
    'flow-03-p': 'Local rules or an HTTP adapter choose the next safe guidance step.',
    'flow-04-h3': 'Piper WASM TTS',
    'flow-04-p': 'The assistant speaks locally after the voice model is prepared.',
    /* architecture section */
    'arch-eyebrow': 'Architecture',
    'arch-h2': 'Copy the static files. Register only safe page actions.',
    'tab-html': 'HTML',
    'tab-init': 'Init',
    'tab-actions': 'Actions',
    'btn-copy-snippet': 'Copy active snippet',
    'btn-copied': 'Copied',
    /* test path section */
    'test-eyebrow': 'Human test path',
    'test-h2': 'Five checks before you publish.',
    'test-p': 'If all five boxes pass on your phone over LTE, the static demo is ready to share.',
    'check-secure-h3': 'Secure context',
    'check-secure-p': 'Required for microphone access. GitHub Pages provides HTTPS.',
    'check-secure-btn': 'Run check',
    'check-secure-default': 'Not run',
    'check-wasm-h3': 'WASM available',
    'check-wasm-p': 'Required by Transformers.js and Piper browser inference.',
    'check-wasm-btn': 'Run check',
    'check-wasm-default': 'Not run',
    'check-worker-h3': 'Worker support',
    'check-worker-p': 'Required to keep model work off the main UI thread.',
    'check-worker-btn': 'Run check',
    'check-worker-default': 'Not run',
    'check-storage-h3': 'Browser storage',
    'check-storage-p': 'Model downloads should be cacheable after first load.',
    'check-storage-btn': 'Run check',
    'check-storage-default': 'Not run',
    'check-mic-h3': 'Microphone API',
    'check-mic-p': 'Permission is requested only after the user starts voice mode.',
    'check-mic-btn': 'Run check',
    'check-mic-default': 'Not run',
    /* start section */
    'start-eyebrow': 'Get started',
    'start-h2': 'Ship it from a repository, a CDN, or GitHub Pages.',
    'start-local-h3': 'Run locally',
    'start-example-h3': 'Open the working example',
    'start-example-p': 'The vanilla example contains the concrete page actions, scenario engine, and WASM speech adapters.',
    'btn-open-example': 'Open examples/vanilla',
    /* faq section */
    'faq-eyebrow': 'FAQ',
    'faq-h2': 'Designed for static hosting and honest runtime boundaries.',
    'faq-q1': 'Does this use the browser Speech API?',
    'faq-a1': 'No. The default speech path uses WASM STT and Piper WASM TTS. The fallback is no-op so audio is never silently sent to browser-vendor speech services.',
    'faq-q2': 'Will it work on GitHub Pages?',
    'faq-a2': 'Yes for the static overlay, text path, workers, and non-threaded WASM. Models are downloaded lazily from their configured CDNs.',
    'faq-q3': 'Can I connect a real AI backend?',
    'faq-a3': 'Yes. Swap the local scenario engine for the HTTP adapter and keep the same registered action boundary.',
    'faq-q4': 'Why are models not committed?',
    'faq-a4': 'Model binaries are large and should stay out of the repo. First-load downloads are cached by the browser where supported.',
    /* footer */
    'footer-copy': 'MIT template for static AI support overlays.',
    'footer-issues': 'Issues',
    'footer-browser-support': 'Browser support notes',
    /* dynamic strings used in landing.js */
    'status-idle': 'Idle',
    'status-preparing': 'Preparing',
    'status-listening': 'Listening',
    'status-thinking': 'Thinking',
    'status-speaking': 'Speaking',
    'status-ended': 'Ended',
    'status-error': 'Error',
    'check-pass-secure': 'Secure context is active.',
    'check-fail-secure': 'This page is not secure. Use HTTPS or localhost.',
    'check-pass-wasm': 'WebAssembly module validation passed.',
    'check-fail-wasm': 'WebAssembly is not available in this browser.',
    'check-pass-worker': 'Dedicated worker executed a probe.',
    'check-fail-worker': 'Dedicated workers are blocked or unavailable.',
    'check-pass-storage': 'IndexedDB opened and cleaned up.',
    'check-warn-storage': 'IndexedDB is unavailable; model caching may be limited.',
    'check-fail-mic': 'getUserMedia is not available.',
    'check-warn-mic-no-state': 'Microphone API exists; permission state is unavailable until click.',
    'check-fail-mic-denied': 'Microphone permission is denied for this site.',
    'check-warn-mic-gesture': 'Microphone API exists; permission state requires a user gesture.',
    'check-pass-mic-prefix': 'Microphone permission state: ',
    'check-checking': 'Checking...',
    'check-failed': 'Check failed.',
    'note-progress': '{area} {phase} {progress}%',
    'note-error': 'Error in {area}: {message}',
    'note-action': 'Action {id}: {status}',
    'note-tts-not-prepared': 'Text reply shown. Press Prepare first to enable Piper WASM TTS.',
    'diagnostics-summary': '{pass} passing, {warn} warning, {fail} failing checks.',
    'ticket-draft-template': 'Issue: {issue}\nPage: {page}\nSpeech: WASM STT {sttModel}, Piper {ttsVoice}',
    'ticket-no-issue': 'No issue captured yet',
    'lang-toggle-label': 'Switch language',
    'theme-toggle-dark': 'Dark mode',
    'theme-toggle-light': 'Light mode',
    /* scenario card meta labels */
    'meta-intent': 'Scenario intent',
    'meta-workflow': 'Workflow issue type',
    'meta-phrase': 'Sample phrase',
    'meta-terms': 'Match terms',
    'meta-actions': 'Safe actions',
    /* nav + hero: flow builder */
    'nav-onboard': 'Get started',
    'nav-flow-builder': 'Flow builder',
    'btn-flow-builder': 'Open Flow Builder',
    /* onboarding (3 steps) */
    'aria-onboard': 'Get started in three steps',
    'onboard-eyebrow': 'Get started in 3 steps',
    'onboard-h2': 'From live demo to your own no-code flow in minutes.',
    'onboard-step1-h3': 'Try the live demo',
    'onboard-step1-p': 'Type or talk to the AI overlay running on this page. No setup, no API key.',
    'onboard-step2-h3': 'Build a flow, no code',
    'onboard-step2-p': 'Open the visual Flow Builder, drag nodes, and export a config bundle (JSON).',
    'onboard-step3-h3': 'Ship it anywhere',
    'onboard-step3-p': 'Drop the bundle and one script tag on any static host. Works on GitHub Pages.',
  }),

  ko: Object.freeze({
    /* skip link + region aria-labels (screen-reader / on-focus) */
    'skip-link': '본문으로 건너뛰기',
    'aria-brand': 'Website AI Call Center 홈',
    'aria-nav-primary': '주요 메뉴',
    'aria-hero-actions': '주요 작업',
    'aria-badges': '프로젝트 주요 특징',
    'aria-signal': '신호 미리보기',
    'aria-phrase-grid': '예시 지원 문구',
    'aria-demo-targets': '데모 페이지 대상',
    'aria-ticket-draft': '지원 티켓 초안',
    'aria-scenario-catalog': '콜 시나리오 카탈로그',
    'aria-arch-diagram': '아키텍처 다이어그램',
    'aria-tablist': '통합 코드 조각',
    'aria-checklist': '런타임 점검',
    /* nav */
    'nav-demo': '데모',
    'nav-scenarios': '시나리오',
    'nav-architecture': '아키텍처',
    'nav-test-path': '테스트 경로',
    'nav-start': '시작하기',
    /* hero */
    'hero-eyebrow': '정적 사이트용 AI 지원 오버레이',
    'hero-h1': '어떤 웹사이트에든 프라이빗 AI 콜센터를 더하세요.',
    'hero-subcopy': '브라우저 로컬 STT 및 TTS. 서버, API 키, Web Speech 불필요. 정적 사이트에 스크립트 하나만 추가하세요.',
    'btn-demo': '라이브 데모 보기',
    'btn-github': 'GitHub에서 보기',
    'badge-client': '100% 클라이언트 측',
    'badge-wasm': 'WASM',
    'badge-lazy': '지연 모델 로드',
    'badge-mit': 'MIT',
    'signal-channel': '지원 채널',
    'model-progress-idle': '준비 버튼을 누르기 전까지 모델은 로드되지 않습니다.',
    'wasm-mode': '단일 스레드 WASM 모드',
    /* what section */
    'what-eyebrow': '소개',
    'what-h2': '프레임워크 없이 재사용 가능한 인터랙션 레이어 하나.',
    'feature-dropin-kicker': '간편 설치',
    'feature-dropin-h3': '프레임워크 무관',
    'feature-dropin-p': '순수 HTML. Astro, Next export, Hugo, CMS 페이지, 또는 index.html에서 바로 동작합니다.',
    'feature-local-kicker': '로컬 우선',
    'feature-local-h3': '브라우저 음성 스택',
    'feature-local-p': 'STT에는 Transformers.js onnx-community/distil-small.en q4를, TTS에는 Piper WASM을 사용합니다.',
    'feature-safe-kicker': '안전',
    'feature-safe-h3': '등록된 액션만 허용',
    'feature-safe-p': '어시스턴트는 페이지에 등록된 액션만 실행할 수 있습니다. 임의 스크립트나 숨겨진 DOM 조작은 허용되지 않습니다.',
    /* demo section */
    'demo-eyebrow': '라이브 데모',
    'demo-h2': '페이지에 말을 걸면, 페이지가 스스로 안내합니다.',
    'demo-p': '이 랜딩 페이지가 직접 오버레이 번들을 실행합니다. 텍스트 지원은 즉시 사용할 수 있습니다. 음성 지원은 준비 버튼을 누른 후 WASM STT/TTS를 활성화합니다.',
    'demo-card-header': '지원 문구 선택',
    'demo-open-full': '전체 데모 열기',
    'btn-open-overlay': '지원 오버레이 열기',
    'demo-note-default': '오버레이는 ./dist/website-ai-call-center.iife.js에서 마운트됩니다.',
    /* demo targets */
    'target-audio-kicker': '오디오 설정',
    'target-audio-h3': '헤드셋 및 스피커 확인',
    'target-audio-p': '출력 장치, 음소거, 브라우저 권한 확인 과정을 안내합니다.',
    'target-account-kicker': '계정',
    'target-account-h3': '설정 및 프로필 경로',
    'target-account-p': '올바른 패널을 표시하고 선택자 추측 없이 도움말 쿼리를 미리 입력합니다.',
    'target-diagnostics-kicker': '진단',
    'target-diagnostics-h3': '브라우저 로컬 점검',
    'diagnostic-copy-default': '아직 점검이 실행되지 않았습니다.',
    'target-ticket-kicker': '에스컬레이션',
    'target-ticket-h3': '지원 티켓 초안',
    'ticket-placeholder': '지원 티켓 초안이 여기에 표시됩니다',
    /* scenarios section */
    'scenarios-eyebrow': '콜 시나리오 카탈로그',
    'scenarios-h2': '읽기 쉬운 목록 하나로 콜 흐름을 관리하세요.',
    'scenarios-p': '각 카드는 검증된 scenarios/*.yml에서 생성됩니다: 인텐트, 워크플로 경로, 예시 문구, 매칭 키워드, 어시스턴트 응답, 그리고 페이지에서 실행할 수 있는 안전한 액션.',
    /* how section */
    'how-eyebrow': '동작 원리',
    'how-h2': '음성과 안내가 모듈로 분리됩니다.',
    'flow-01-h3': '마이크 입력',
    'flow-01-p': '사용자가 클릭한 후에만 마이크 접근을 허용합니다.',
    'flow-02-h3': 'WASM STT',
    'flow-02-p': 'Transformers.js가 워커 기반 브라우저 모델로 음성을 텍스트로 변환합니다.',
    'flow-03-h3': '시나리오 엔진',
    'flow-03-p': '로컬 규칙 또는 HTTP 어댑터가 다음 안전한 안내 단계를 선택합니다.',
    'flow-04-h3': 'Piper WASM TTS',
    'flow-04-p': '음성 모델 준비 후 어시스턴트가 로컬에서 음성으로 응답합니다.',
    /* architecture section */
    'arch-eyebrow': '아키텍처',
    'arch-h2': '정적 파일을 복사하고 안전한 페이지 액션만 등록하세요.',
    'tab-html': 'HTML',
    'tab-init': '초기화',
    'tab-actions': '액션',
    'btn-copy-snippet': '현재 코드 복사',
    'btn-copied': '복사됨',
    /* test path section */
    'test-eyebrow': '테스트 경로',
    'test-h2': '배포 전 다섯 가지 점검.',
    'test-p': '스마트폰 LTE 환경에서 다섯 항목이 모두 통과되면 정적 데모를 공유할 준비가 된 것입니다.',
    'check-secure-h3': '보안 컨텍스트',
    'check-secure-p': '마이크 접근에 필요합니다. GitHub Pages는 HTTPS를 제공합니다.',
    'check-secure-btn': '점검 실행',
    'check-secure-default': '미실행',
    'check-wasm-h3': 'WASM 사용 가능',
    'check-wasm-p': 'Transformers.js 및 Piper 브라우저 추론에 필요합니다.',
    'check-wasm-btn': '점검 실행',
    'check-wasm-default': '미실행',
    'check-worker-h3': '워커 지원',
    'check-worker-p': '모델 작업을 메인 UI 스레드에서 분리하는 데 필요합니다.',
    'check-worker-btn': '점검 실행',
    'check-worker-default': '미실행',
    'check-storage-h3': '브라우저 저장소',
    'check-storage-p': '첫 로드 이후 모델 다운로드가 캐시될 수 있어야 합니다.',
    'check-storage-btn': '점검 실행',
    'check-storage-default': '미실행',
    'check-mic-h3': '마이크 API',
    'check-mic-p': '사용자가 음성 모드를 시작한 후에만 권한을 요청합니다.',
    'check-mic-btn': '점검 실행',
    'check-mic-default': '미실행',
    /* start section */
    'start-eyebrow': '시작하기',
    'start-h2': '리포지토리, CDN, 또는 GitHub Pages에서 배포하세요.',
    'start-local-h3': '로컬 실행',
    'start-example-h3': '작동 예제 열기',
    'start-example-p': 'Vanilla 예제에는 구체적인 페이지 액션, 시나리오 엔진, WASM 음성 어댑터가 포함되어 있습니다.',
    'btn-open-example': 'examples/vanilla 열기',
    /* faq section */
    'faq-eyebrow': 'FAQ',
    'faq-h2': '정적 호스팅과 정직한 런타임 경계를 위해 설계되었습니다.',
    'faq-q1': '브라우저 Speech API를 사용하나요?',
    'faq-a1': '아닙니다. 기본 음성 경로는 WASM STT와 Piper WASM TTS를 사용합니다. 폴백은 no-op이므로 오디오가 브라우저 음성 서비스로 자동 전송되지 않습니다.',
    'faq-q2': 'GitHub Pages에서 동작하나요?',
    'faq-a2': '정적 오버레이, 텍스트 경로, 워커, 단일 스레드 WASM은 모두 동작합니다. 모델은 설정된 CDN에서 지연 다운로드됩니다.',
    'faq-q3': '실제 AI 백엔드를 연결할 수 있나요?',
    'faq-a3': '가능합니다. 로컬 시나리오 엔진을 HTTP 어댑터로 교체하고 동일한 등록 액션 경계를 유지하면 됩니다.',
    'faq-q4': '모델이 리포지토리에 포함되지 않는 이유는 무엇인가요?',
    'faq-a4': '모델 바이너리는 용량이 크므로 리포지토리에서 제외해야 합니다. 첫 로드 후 다운로드는 지원되는 브라우저에서 캐시됩니다.',
    /* footer */
    'footer-copy': '정적 AI 지원 오버레이를 위한 MIT 템플릿.',
    'footer-issues': '이슈',
    'footer-browser-support': '브라우저 지원 정보',
    /* dynamic strings used in landing.js */
    'status-idle': '대기 중',
    'status-preparing': '준비 중',
    'status-listening': '듣는 중',
    'status-thinking': '처리 중',
    'status-speaking': '말하는 중',
    'status-ended': '종료됨',
    'status-error': '오류',
    'check-pass-secure': '보안 컨텍스트가 활성화되어 있습니다.',
    'check-fail-secure': '이 페이지는 보안 컨텍스트가 아닙니다. HTTPS 또는 localhost를 사용하세요.',
    'check-pass-wasm': 'WebAssembly 모듈 검증이 통과되었습니다.',
    'check-fail-wasm': '이 브라우저에서 WebAssembly를 사용할 수 없습니다.',
    'check-pass-worker': '전용 워커가 프로브를 실행했습니다.',
    'check-fail-worker': '전용 워커가 차단되어 있거나 사용할 수 없습니다.',
    'check-pass-storage': 'IndexedDB가 열리고 정리되었습니다.',
    'check-warn-storage': 'IndexedDB를 사용할 수 없습니다. 모델 캐싱이 제한될 수 있습니다.',
    'check-fail-mic': 'getUserMedia를 사용할 수 없습니다.',
    'check-warn-mic-no-state': '마이크 API는 있지만, 클릭 전에는 권한 상태를 확인할 수 없습니다.',
    'check-fail-mic-denied': '이 사이트의 마이크 권한이 거부되었습니다.',
    'check-warn-mic-gesture': '마이크 API는 있지만, 권한 상태 확인에는 사용자 제스처가 필요합니다.',
    'check-pass-mic-prefix': '마이크 권한 상태: ',
    'check-checking': '확인 중...',
    'check-failed': '점검에 실패했습니다.',
    'note-progress': '{area} {phase} {progress}%',
    'note-error': '{area} 오류: {message}',
    'note-action': '동작 {id}: {status}',
    'note-tts-not-prepared': '텍스트 응답이 표시됩니다. Piper WASM TTS를 사용하려면 먼저 준비를 누르세요.',
    'diagnostics-summary': '{pass}개 통과, {warn}개 경고, {fail}개 실패.',
    'ticket-draft-template': '문제: {issue}\n페이지: {page}\n음성: WASM STT {sttModel}, Piper {ttsVoice}',
    'ticket-no-issue': '아직 캡처된 문제가 없습니다',
    'lang-toggle-label': '언어 전환',
    'theme-toggle-dark': '다크 모드',
    'theme-toggle-light': '라이트 모드',
    /* scenario card meta labels */
    'meta-intent': '시나리오 인텐트',
    'meta-workflow': '워크플로 유형',
    'meta-phrase': '예시 문구',
    'meta-terms': '매칭 키워드',
    'meta-actions': '허용 액션',
    /* nav + hero: flow builder */
    'nav-onboard': '시작하기',
    'nav-flow-builder': '플로우 빌더',
    'btn-flow-builder': '플로우 빌더 열기',
    /* onboarding (3 steps) */
    'aria-onboard': '3단계로 시작하기',
    'onboard-eyebrow': '3단계로 시작',
    'onboard-h2': '라이브 데모에서 나만의 노코드 플로우까지, 몇 분이면 됩니다.',
    'onboard-step1-h3': '라이브 데모 체험',
    'onboard-step1-p': '이 페이지에서 동작하는 AI 오버레이에 입력하거나 말해 보세요. 설정·API 키 불필요.',
    'onboard-step2-h3': '노코드로 플로우 제작',
    'onboard-step2-p': '비주얼 플로우 빌더에서 노드를 끌어다 놓고 config 번들(JSON)을 내보냅니다.',
    'onboard-step3-h3': '어디서나 배포',
    'onboard-step3-p': '번들과 script 태그 한 줄을 정적 호스트에 올리면 끝. GitHub Pages에서도 동작합니다.',
  }),
});

/** @type {string} */
let _currentLocale = 'en';

/** @type {Array<(locale: string) => void>} */
const _callbacks = [];

/**
 * Normalize a BCP-47 tag to a supported locale code.
 * 'ko-KR' -> 'ko', 'en-US' -> 'en'. Falls back to 'en'.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
function normalizeLocale(raw) {
  if (!raw) return 'en';
  const base = String(raw).toLowerCase().split('-')[0].trim();
  return Object.prototype.hasOwnProperty.call(LANDING_STRINGS, base) ? base : 'en';
}

/**
 * Determine the initial locale from URL param > localStorage > navigator > 'en'.
 * @returns {string}
 */
export function resolveInitialLocale() {
  const param = new URLSearchParams(location.search).get('lang');
  if (param) return normalizeLocale(param);
  const stored = localStorage.getItem('waicc-locale');
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(navigator.language);
}

/**
 * Return the currently active locale code.
 * @returns {string}
 */
export function getLocale() {
  return _currentLocale;
}

/**
 * Apply a locale: update <html lang>, optionally persist, swap [data-i18n] text,
 * swap [data-i18n-placeholder] placeholders, swap [data-i18n-aria] aria-labels,
 * update the lang toggle, fire callbacks.
 *
 * Elements flagged with `data-i18n-default` are runtime-owned: their attribute
 * value is the localized PLACEHOLDER default. applyLocale only sets that default
 * when the element still shows a known default (initial load or unused readout);
 * once live content is present, callbacks (fired last) re-apply the live value.
 *
 * @param {string} locale
 * @param {{ persist?: boolean }} [options]
 */
export function applyLocale(locale, { persist = true } = {}) {
  const resolved = normalizeLocale(locale);
  _currentLocale = resolved;

  document.documentElement.lang = resolved;

  if (persist) {
    localStorage.setItem('waicc-locale', resolved);
  }

  const strings = LANDING_STRINGS[resolved] || LANDING_STRINGS['en'];
  const fallback = LANDING_STRINGS['en'];

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = strings[key] ?? fallback[key];
    if (value !== undefined) el.textContent = value;
  });

  applyRuntimeDefaults(strings, fallback);

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = strings[key] ?? fallback[key];
    if (value !== undefined && el instanceof HTMLElement) {
      el.setAttribute('placeholder', value);
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const value = strings[key] ?? fallback[key];
    if (value !== undefined && el instanceof HTMLElement) {
      el.setAttribute('aria-label', value);
    }
  });

  const toggle = document.querySelector('#lang-toggle');
  if (toggle instanceof HTMLButtonElement) {
    toggle.setAttribute('aria-pressed', String(resolved === 'ko'));
    toggle.dataset.locale = resolved;
  }

  _callbacks.forEach((cb) => cb(resolved));
}

/**
 * Localize `[data-i18n-default]` (runtime-owned) elements only while they still
 * show a known per-locale default. Once a readout holds live content, it is left
 * untouched here so the dynamic value survives a language switch (landing.js
 * re-applies the live value via onLocaleChange, which fires after this sweep).
 *
 * @param {Record<string, string>} strings Active-locale strings.
 * @param {Record<string, string>} fallback English fallback strings.
 */
function applyRuntimeDefaults(strings, fallback) {
  document.querySelectorAll('[data-i18n-default]').forEach((el) => {
    const key = el.getAttribute('data-i18n-default');
    const value = strings[key] ?? fallback[key];
    if (value === undefined) return;
    if (isDefaultText(el.textContent, key)) el.textContent = value;
  });
}

/**
 * @param {string|null} text Current element text.
 * @param {string} key The data-i18n-default key.
 * @returns {boolean} True if text matches the default for any supported locale.
 */
function isDefaultText(text, key) {
  const current = (text ?? '').trim();
  if (current === '') return true;
  return Object.values(LANDING_STRINGS).some((dict) => (dict[key] ?? '').trim() === current);
}

/**
 * Register a callback to be called whenever the locale changes.
 * @param {(locale: string) => void} cb
 */
export function onLocaleChange(cb) {
  _callbacks.push(cb);
}
