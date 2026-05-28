/**
 * Built-in overlay UI string dictionaries. English is the default and the
 * fallback for every missing Korean value. All values are deeply frozen so
 * callers cannot mutate the shared dictionary.
 */

/** @typedef {{ idle: string, preparing: string, listening: string, thinking: string, speaking: string, ended: string, error: string }} StatusStrings */
/**
 * @typedef {object} UiStrings
 * @property {string} fab Floating action button label.
 * @property {string} title Dialog title.
 * @property {string} close Close button aria-label.
 * @property {string} inputLabel Textarea label.
 * @property {string} inputPlaceholder Textarea placeholder.
 * @property {string} send Send button label.
 * @property {string} voiceStart Voice button label when ready to listen.
 * @property {string} voiceStop Voice button label while listening.
 * @property {string} prepare Voice button label before models are loaded.
 * @property {string} stopSpeaking Stop-speaking button label (stops TTS).
 * @property {string} end End-call button label.
 * @property {string} prepareHint Hint shown before voice is prepared.
 * @property {StatusStrings} status Status-pill text keyed by machine state.
 */

/** Supported overlay locales. @type {readonly ['en', 'ko']} */
export const UI_LOCALES = Object.freeze(['en', 'ko']);

/** Default and fallback locale. @type {'en'} */
export const DEFAULT_LOCALE = 'en';

/** Frozen per-locale string dictionaries. @type {Readonly<Record<'en'|'ko', UiStrings>>} */
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
