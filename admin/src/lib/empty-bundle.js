// Factory for a minimal, schema-VALID starting config bundle. A fresh canvas
// must still export and validate, so the skeleton carries the schema-required
// floor: one intent (intents minItems 1) and one fully-formed scenario
// (call-scenario.schema.json required fields), plus an empty flow. Pure: returns
// a new object each call, no shared mutable references.

/**
 * Build a fresh, schema-valid config bundle for a new project.
 * @returns {object} A new config-bundle (schemaVersion '2') with an empty flow.
 */
export function makeEmptyBundle() {
  return {
    schemaVersion: '2',
    tenant: {
      id: 'demo',
      name: 'New Tenant',
      locales: ['en', 'ko'],
    },
    domain: 'custom',
    disclosure: {
      required: true,
      showOn: 'first-interaction',
      text: {
        en: 'You are chatting with an AI assistant.',
        ko: 'AI 도우미와 대화 중입니다.',
      },
    },
    intentModel: {
      resolver: 'keyword',
      threshold: 0,
      model: null,
    },
    intents: [
      {
        id: 'general_help',
        utterances: ['I need help', 'Can you assist me'],
        scenario: 'general',
      },
    ],
    scenarios: [
      {
        id: 'general',
        scenario_intent: 'general_help',
        title: 'General help',
        button_label: 'Get help',
        summary: 'A starting scenario you can edit or replace.',
        utterances: ['I need help', 'Can you assist me'],
        match: { keywords: ['help', 'assist'] },
        reply: { text: 'How can I help you today?' },
        frontend_actions: [{ id: 'show-help', label: 'Show help' }],
        workflow: { issue_type: 'general_help', handoff: false },
      },
    ],
    flow: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
  };
}
