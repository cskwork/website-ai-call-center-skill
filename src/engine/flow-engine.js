import { createKeywordIntentResolver } from '../intent/keyword-resolver.js';

const DEFAULT_FALLBACK = Object.freeze({
  en: 'I am not sure yet. Could you rephrase, or describe what you were trying to do?',
  ko: '아직 잘 모르겠어요. 다시 말씀해 주시거나, 무엇을 하려 했는지 알려 주세요.',
});

/**
 * Create a client-side, bundle-driven engine adapter. It resolves the user's
 * intent with a pluggable IntentResolver, maps the intent to a scenario, and
 * returns that scenario's localized reply + safe actions. It keeps a Rasa-style
 * slot store, shows the AI-use disclosure once on first interaction, and
 * surfaces a handoff signal. Satisfies the same adapter contract as
 * createLocalRuleEngine (`startSession` / `sendUserText` / `endSession`), so it
 * is a drop-in `engine` for createWebsiteCallCenter.
 *
 * @param {object} options
 * @param {object} options.bundle Config bundle (config-bundle.schema.json v2).
 * @param {object} [options.intentResolver] IntentResolver (defaults to keyword).
 * @param {string} [options.locale] 'en' (default) or 'ko'.
 * @param {number} [options.threshold] Min score to accept a match (resolver-relative).
 * @returns {{ prepare: (onProgress?: Function) => Promise<void>,
 *   startSession: () => Promise<{ sessionId: string }>,
 *   sendUserText: (text: string, context?: object) => Promise<object>,
 *   endSession: () => Promise<void> }}
 */
export function createFlowEngine({ bundle, intentResolver, locale = 'en', threshold } = {}) {
  if (!bundle || !Array.isArray(bundle.scenarios)) {
    throw new Error('createFlowEngine requires a config bundle with a scenarios array.');
  }
  const resolver = intentResolver || createKeywordIntentResolver();
  const intents = buildIntents(bundle);
  const minScore = threshold ?? bundle.intentModel?.threshold ?? 0;
  const lang = locale === 'ko' ? 'ko' : 'en';
  let session = null;

  async function prepare(onProgress) {
    await resolver.prepare?.(onProgress);
  }

  async function startSession() {
    await resolver.prepare?.();
    session = {
      sessionId: `flow-${Date.now().toString(36)}`,
      slots: initialSlots(bundle),
      disclosed: false,
    };
    return { sessionId: session.sessionId };
  }

  // context is accepted for adapter signature symmetry; unused by this engine.
  async function sendUserText(text, context = {}) {
    void context;
    if (!session) await startSession();
    const { intent, score, scores } = await resolver.classify(String(text || ''), { intents, locale: lang });
    const accepted = intent && score > 0 && score >= minScore ? intent : null;
    const scenario = accepted ? scenarioForIntent(bundle, accepted) : null;
    const prefix = takeDisclosure();

    if (!scenario) {
      return reply({ text: prefix + fallbackText(bundle, lang), actions: [], scenarioId: null, intent: null, score, scores });
    }
    fillSlotsFromIntent(accepted);
    const view = localizedScenario(scenario, lang);
    return reply({
      text: prefix + view.text,
      actions: view.actions,
      scenarioId: scenario.id,
      intent: accepted,
      score,
      scores,
      workflow: scenario.workflow,
      handoff: Boolean(scenario.workflow?.handoff),
    });
  }

  async function endSession() {
    session = null;
  }

  function takeDisclosure() {
    const disclosure = bundle.disclosure;
    if (!disclosure?.required || disclosure.showOn === 'off' || session.disclosed) return '';
    session.disclosed = true;
    const text = disclosure.text?.[lang] ?? disclosure.text?.en ?? '';
    return text ? `${text}\n\n` : '';
  }

  function fillSlotsFromIntent(intentId) {
    for (const [name, def] of Object.entries(bundle.slots || {})) {
      for (const mapping of def.mappings || []) {
        if (mapping.type === 'from_intent' && intentMatches(mapping.intent, intentId)) {
          session.slots[name] = 'value' in mapping ? mapping.value : intentId;
        }
      }
    }
  }

  function reply(extra) {
    return { sessionId: session.sessionId, slots: { ...session.slots }, ...extra };
  }

  return { prepare, startSession, sendUserText, endSession };
}

/**
 * Build per-intent candidates the resolvers consume: keyword `terms` (EN+KO
 * union) for the keyword resolver and `utterances` (EN+KO union) for embedding
 * resolvers. Mirrors the unionTerms approach in scripts/build-scenarios.mjs.
 *
 * @param {object} bundle Config bundle.
 * @returns {Array<{ id: string, scenario: string, terms: string[], utterances: string[] }>}
 */
function buildIntents(bundle) {
  return (bundle.intents || []).map((intent) => {
    const scenario = bundle.scenarios.find((entry) => entry.id === intent.scenario)
      ?? bundle.scenarios.find((entry) => entry.scenario_intent === intent.id);
    return {
      id: intent.id,
      scenario: scenario?.id ?? intent.scenario,
      terms: union(scenario?.match?.keywords, scenario?.i18n?.ko?.match?.keywords),
      utterances: union(intent.utterances, scenario?.i18n?.ko?.utterances),
    };
  });
}

function scenarioForIntent(bundle, intentId) {
  const intent = (bundle.intents || []).find((entry) => entry.id === intentId);
  const byRef = intent && bundle.scenarios.find((entry) => entry.id === intent.scenario);
  return byRef || bundle.scenarios.find((entry) => entry.scenario_intent === intentId) || null;
}

function localizedScenario(scenario, lang) {
  const ko = lang === 'ko' ? scenario.i18n?.ko : undefined;
  return {
    text: ko?.reply?.text ?? scenario.reply?.text ?? '',
    actions: localizedActions(scenario.frontend_actions, ko?.frontend_actions),
  };
}

function localizedActions(enActions = [], koActions) {
  if (!koActions) return enActions.map((action) => ({ id: action.id, label: action.label }));
  const labels = new Map(koActions.map((action) => [action.id, action.label]));
  return enActions.map((action) => ({ id: action.id, label: labels.get(action.id) ?? action.label }));
}

function initialSlots(bundle) {
  const slots = {};
  for (const [name, def] of Object.entries(bundle.slots || {})) {
    slots[name] = 'initial_value' in def ? def.initial_value : null;
  }
  return slots;
}

function intentMatches(spec, intentId) {
  return Array.isArray(spec) ? spec.includes(intentId) : spec === intentId;
}

function fallbackText(bundle, lang) {
  return bundle.fallback?.[lang] ?? bundle.fallback?.en ?? DEFAULT_FALLBACK[lang] ?? DEFAULT_FALLBACK.en;
}

function union(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const term of list || []) {
      const key = String(term || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(term);
    }
  }
  return merged;
}
