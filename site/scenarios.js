import { CALL_SCENARIOS } from './generated/scenarios.js';

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
});

export { CALL_SCENARIOS };

export function matchCallScenario(text) {
  const normalized = normalize(text);
  const ranked = CALL_SCENARIOS
    .map((entry) => ({ entry, score: scoreScenario(normalized, entry) }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score > 0 ? ranked[0].entry : DEFAULT_SCENARIO;
}

export function matchScenarioIntent(scenarioIntent) {
  const normalized = normalizeIntent(scenarioIntent);
  return CALL_SCENARIOS.find((entry) => entry.scenario_intent === normalized) || DEFAULT_SCENARIO;
}

export function getScenarioReply(text) {
  return replyForScenario(matchCallScenario(text));
}

export function getScenarioReplyForIntent(scenarioIntent) {
  return replyForScenario(matchScenarioIntent(scenarioIntent));
}

function replyForScenario(selected) {
  return {
    scenarioId: selected.id,
    scenario_intent: selected.scenario_intent,
    workflow: { ...selected.workflow },
    text: selected.replyText,
    actions: selected.actions.map((action) => ({ ...action })),
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
