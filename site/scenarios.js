import { CALL_SCENARIOS } from './generated/scenarios.js';

const DEFAULT_LOCALE = 'en';

const DEFAULT_SCENARIO = Object.freeze({
  id: 'default',
  scenario_intent: 'general_help',
  title: 'Default guidance',
  buttonLabel: 'General help',
  summary: 'Offers the safest starting points when no scenario matches.',
  phrase: 'I need help with this page',
  utterances: Object.freeze(['I need help with this page']),
  terms: Object.freeze([]),
  replyText: 'I can guide this static page. Try audio setup, account settings, diagnostics, or ticket drafting.',
  actions: Object.freeze([
    Object.freeze({ id: 'show-audio', label: 'Show audio setup' }),
    Object.freeze({ id: 'run-checks', label: 'Run browser checks' }),
  ]),
  workflow: Object.freeze({ issue_type: 'general_support', handoff: false }),
  localized: Object.freeze({
    en: Object.freeze({
      title: 'Default guidance',
      buttonLabel: 'General help',
      summary: 'Offers the safest starting points when no scenario matches.',
      phrase: 'I need help with this page',
      utterances: Object.freeze(['I need help with this page']),
      replyText: 'I can guide this static page. Try audio setup, account settings, diagnostics, or ticket drafting.',
      actions: Object.freeze([
        Object.freeze({ id: 'show-audio', label: 'Show audio setup' }),
        Object.freeze({ id: 'run-checks', label: 'Run browser checks' }),
      ]),
    }),
    ko: Object.freeze({
      title: '기본 안내',
      buttonLabel: '일반 도움말',
      summary: '일치하는 시나리오가 없을 때 가장 안전한 시작점을 제시합니다.',
      phrase: '이 페이지에 대해 도움이 필요해요',
      utterances: Object.freeze(['이 페이지에 대해 도움이 필요해요']),
      replyText: '이 정적 페이지를 안내해 드릴게요. 오디오 설정, 계정 설정, 진단, 티켓 작성 중에서 시도해 보세요.',
      actions: Object.freeze([
        Object.freeze({ id: 'show-audio', label: '오디오 설정 보기' }),
        Object.freeze({ id: 'run-checks', label: '브라우저 점검 실행' }),
      ]),
    }),
  }),
});

export { CALL_SCENARIOS };

/**
 * Find the best-matching scenario for free text using the locale-agnostic union terms.
 * @param {string} text user utterance
 * @returns {object} matched scenario or DEFAULT_SCENARIO
 */
export function matchCallScenario(text) {
  const normalized = normalize(text);
  const ranked = CALL_SCENARIOS
    .map((entry) => ({ entry, score: scoreScenario(normalized, entry) }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score > 0 ? ranked[0].entry : DEFAULT_SCENARIO;
}

/**
 * Resolve a scenario by detected intent name.
 * @param {string} scenarioIntent intent identifier
 * @returns {object} matched scenario or DEFAULT_SCENARIO
 */
export function matchScenarioIntent(scenarioIntent) {
  const normalized = normalizeIntent(scenarioIntent);
  return CALL_SCENARIOS.find((entry) => entry.scenario_intent === normalized) || DEFAULT_SCENARIO;
}

/**
 * Build a localized reply for free text. Matching is locale-agnostic; the reply
 * text and action labels are taken from the requested locale with EN fallback.
 * @param {string} text user utterance
 * @param {string} [locale='en'] reply locale ('en' or 'ko')
 * @returns {{scenarioId,scenario_intent,workflow,text,actions}}
 */
export function getScenarioReply(text, locale = DEFAULT_LOCALE) {
  return replyForScenario(matchCallScenario(text), locale);
}

/**
 * Build a localized reply for a detected intent.
 * @param {string} scenarioIntent intent identifier
 * @param {string} [locale='en'] reply locale ('en' or 'ko')
 * @returns {{scenarioId,scenario_intent,workflow,text,actions}}
 */
export function getScenarioReplyForIntent(scenarioIntent, locale = DEFAULT_LOCALE) {
  return replyForScenario(matchScenarioIntent(scenarioIntent), locale);
}

/**
 * Per-locale catalog view of a scenario with EN fallback for missing fields.
 * @param {object} scenario runtime scenario (with `localized` map)
 * @param {string} [locale='en'] view locale
 * @returns {{title,buttonLabel,summary,phrase,replyText,actions,terms}}
 */
export function localizedScenario(scenario, locale = DEFAULT_LOCALE) {
  const view = localizedView(scenario, locale);
  return {
    title: view.title,
    buttonLabel: view.buttonLabel,
    summary: view.summary,
    phrase: view.phrase,
    replyText: view.replyText,
    actions: view.actions.map((action) => ({ ...action })),
    terms: scenario.terms,
  };
}

function localizedView(scenario, locale) {
  const map = scenario.localized || {};
  return map[locale] || map[DEFAULT_LOCALE] || fallbackView(scenario);
}

function fallbackView(scenario) {
  return {
    title: scenario.title,
    buttonLabel: scenario.buttonLabel,
    summary: scenario.summary,
    phrase: scenario.phrase,
    replyText: scenario.replyText,
    actions: scenario.actions,
  };
}

function replyForScenario(selected, locale) {
  const view = localizedView(selected, locale);
  return {
    scenarioId: selected.id,
    scenario_intent: selected.scenario_intent,
    workflow: { ...selected.workflow },
    text: view.replyText,
    actions: view.actions.map((action) => ({ ...action })),
  };
}

function scoreScenario(text, entry) {
  return entry.terms.reduce((score, term) => {
    const token = normalize(term);
    return text.includes(token) ? score + Math.max(1, token.length) : score;
  }, 0);
}

function normalizeIntent(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}
