export const CALL_SCENARIOS = Object.freeze([
  scenario({
    id: 'audio',
    title: 'Audio setup',
    buttonLabel: 'Audio is broken',
    summary: 'Guides headset, speaker, mute, and browser permission checks.',
    phrase: 'I cannot hear audio during a support call',
    terms: ['audio', 'hear', 'speaker', 'sound', 'mute'],
    replyText: 'I can guide audio setup. Start with the headset panel, then run browser checks if voice still fails.',
    actions: [
      { id: 'show-audio', label: 'Show audio setup' },
      { id: 'run-checks', label: 'Run browser checks' },
    ],
  }),
  scenario({
    id: 'account',
    title: 'Account path',
    buttonLabel: 'Find account settings',
    summary: 'Shows where account, settings, profile, and login help live.',
    phrase: 'I cannot find account settings',
    terms: ['account', 'settings', 'profile', 'login'],
    replyText: 'I can point you to the account path and keep the action limited to a registered page target.',
    actions: [{ id: 'show-account', label: 'Show account path' }],
  }),
  scenario({
    id: 'diagnostics',
    title: 'Browser diagnostics',
    buttonLabel: 'Run diagnostics',
    summary: 'Runs honest local checks for secure context, WASM, workers, storage, and mic access.',
    phrase: 'My page says offline and I need diagnostics',
    terms: ['offline', 'diagnostic', 'network', 'page'],
    replyText: 'I can run honest browser capability checks and show the diagnostics card.',
    actions: [{ id: 'run-checks', label: 'Run browser checks' }],
  }),
  scenario({
    id: 'ticket',
    title: 'Ticket draft',
    buttonLabel: 'Draft ticket',
    summary: 'Creates an escalation draft with the captured issue, page path, and speech mode.',
    phrase: 'I need to draft a technical support ticket',
    terms: ['ticket', 'case', 'agent', 'support'],
    replyText: 'I can draft a support ticket with the current page path and your issue summary.',
    actions: [{ id: 'draft-ticket', label: 'Draft support ticket' }],
  }),
]);

const DEFAULT_SCENARIO = scenario({
  id: 'default',
  title: 'Default guidance',
  buttonLabel: 'General help',
  summary: 'Offers the safest starting points when no scenario matches.',
  phrase: 'I need help with this page',
  terms: [],
  replyText: 'I can guide this static page. Try audio setup, account settings, diagnostics, or ticket drafting.',
  actions: [
    { id: 'show-audio', label: 'Show audio setup' },
    { id: 'run-checks', label: 'Run browser checks' },
  ],
});

export function matchCallScenario(text) {
  const normalized = normalize(text);
  const ranked = CALL_SCENARIOS
    .map((entry) => ({ entry, score: scoreScenario(normalized, entry) }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score > 0 ? ranked[0].entry : DEFAULT_SCENARIO;
}

export function getScenarioReply(text) {
  const selected = matchCallScenario(text);
  return {
    scenarioId: selected.id,
    text: selected.replyText,
    actions: selected.actions.map((action) => ({ ...action })),
  };
}

function scenario(definition) {
  return Object.freeze({
    ...definition,
    terms: Object.freeze([...definition.terms]),
    actions: Object.freeze(definition.actions.map((action) => Object.freeze({ ...action }))),
  });
}

function scoreScenario(text, entry) {
  return entry.terms.reduce((score, term) => {
    const token = normalize(term);
    return text.includes(token) ? score + Math.max(1, token.length) : score;
  }, 0);
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}
