const DEFAULT_SCENARIOS = Object.freeze([
  {
    id: 'fallback',
    match: ['help', 'support', 'problem', 'issue', 'error'],
    response: 'I can help with that. Tell me what you were trying to do and what happened on the page.',
    actions: [],
  },
]);

export function createLocalRuleEngine({ scenarios = DEFAULT_SCENARIOS, fallback } = {}) {
  let sessionId = null;

  async function startSession() {
    sessionId = `local-${Date.now().toString(36)}`;
    return { sessionId };
  }

  async function sendUserText(text) {
    const scenario = selectScenario(String(text || ''), scenarios) || fallbackScenario(fallback);
    return {
      sessionId,
      text: scenario.response,
      actions: scenario.actions || [],
      scenarioId: scenario.id,
    };
  }

  async function endSession() {
    sessionId = null;
  }

  return { startSession, sendUserText, endSession };
}

export function selectScenario(text, scenarios) {
  const normalized = normalize(text);
  return scenarios
    .map((scenario) => ({ scenario, score: scoreScenario(normalized, scenario) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.scenario ?? null;
}

function scoreScenario(text, scenario) {
  return (scenario.match || []).reduce((score, keyword) => {
    const token = normalize(keyword);
    return text.includes(token) ? score + Math.max(1, token.length) : score;
  }, 0);
}

function fallbackScenario(fallback) {
  if (fallback) return fallback;
  return {
    id: 'default-fallback',
    response: 'I understand. I will guide you step by step. Which part of the page should we check first?',
    actions: [],
  };
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}
