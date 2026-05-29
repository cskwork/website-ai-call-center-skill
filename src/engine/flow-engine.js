import { createKeywordIntentResolver } from '../intent/keyword-resolver.js';
import { evaluateCondition, FORBIDDEN_KEYS } from './condition.js';

const MAX_HOPS = 50;

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
  const graphMode = isGraphMode(bundle);
  const hasDisclosureNode = graphMode && bundle.flow.nodes.some((node) => nodeKind(node) === 'ai-disclosure');
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
      currentNodeId: graphMode ? startNodeId(bundle.flow) : undefined,
    };
    return { sessionId: session.sessionId };
  }

  // context.entities is consumed by from_entity slot mapping in BOTH modes.
  async function sendUserText(text, context = {}) {
    if (!session) await startSession();
    const entities = context.entities || {};
    fillSlotsFromEntity(entities);
    const { intent, score, scores } = await resolver.classify(String(text || ''), { intents, locale: lang });
    const accepted = intent && score > 0 && score >= minScore ? intent : null;
    if (graphMode) return runGraph({ accepted, score, scores, entities });
    return runLegacy({ accepted, score, scores });
  }

  function runLegacy({ accepted, score, scores }) {
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

  function runGraph({ accepted, score, scores, entities }) {
    const ctx = { slots: { ...session.slots }, intent: accepted, score, entities };
    const out = advance({ ctx, accepted });
    session.currentNodeId = out.nodeId;
    // trim() so the prefix joins with the same single blank line as the legacy
    // path (takeDisclosure already appends \n\n); avoids a 4-newline gap here.
    const prefix = hasDisclosureNode ? '' : takeDisclosure().trim();
    const text = [prefix, ...out.textParts].filter(Boolean).join('\n\n');
    return reply({ text, actions: out.actions, scenarioId: null, intent: accepted, score, scores, handoff: out.handoff });
  }

  // Auto-advance through non-input nodes until an input/handoff/end/dangling
  // node is reached, capped by MAX_HOPS to defeat cyclic graphs. `turn` carries
  // a one-shot `intentConsumed` latch so only the FIRST intent-branch reached in
  // this advance consumes the turn's intent; any later branch is a pure wait.
  function advance({ ctx, accepted }) {
    const flow = bundle.flow;
    let nodeId = session.currentNodeId;
    const textParts = [];
    const actions = [];
    const turn = { intentConsumed: false };
    let handoff = false;
    for (let hops = 0; hops < MAX_HOPS && nodeId != null; hops += 1) {
      const node = nodeById(flow, nodeId);
      if (!node) { nodeId = null; break; }
      const step = stepNode({ node, ctx, accepted, flow, textParts, actions, turn });
      if (step.stop) { handoff = step.handoff || handoff; nodeId = step.nodeId; break; }
      nodeId = step.nodeId;
    }
    return { nodeId, textParts, actions, handoff };
  }

  function stepNode({ node, ctx, accepted, flow, textParts, actions, turn }) {
    const kind = nodeKind(node);
    if (kind === 'message') textParts.push(messageText(node, lang));
    else if (kind === 'ai-disclosure') { const d = takeDisclosure(); if (d) textParts.unshift(d.trim()); }
    else if (kind === 'slot-fill') applySlotFill(node, ctx, accepted);
    else if (kind === 'action') actions.push({ id: node.data?.actionId, label: node.data?.label });
    else if (kind === 'handoff') { textParts.push(messageText(node, lang)); return { stop: true, handoff: true, nodeId: node.id }; }
    else if (kind === 'end') return { stop: true, nodeId: null };
    else if (kind === 'intent-branch') return branchStep({ node, ctx, accepted, textParts, turn });
    // start, http-call (deferred no-op), and unknown kinds fall through to advance.
    return { stop: false, nodeId: nextDefault(node, flow) };
  }

  // The first intent-branch in a turn consumes the intent (pick edge / fallback);
  // a later branch is the next turn's input node, so wait without matching it
  // against this turn's already-spent intent or emitting a spurious fallback.
  function branchStep({ node, ctx, accepted, textParts, turn }) {
    if (turn.intentConsumed) return { stop: true, nodeId: node.id };
    turn.intentConsumed = true;
    const picked = pickEdge(node, ctx, accepted, bundle.flow);
    if (picked) return { stop: false, nodeId: picked.target };
    textParts.push(branchFallback(node, lang));
    return { stop: true, nodeId: node.id };
  }

  // Fill node.data.slot from from_entity (primary), else from this slot's OWN
  // from_intent mappings. Scoped to the named slot so the node never mutates an
  // unrelated slot as a side effect.
  function applySlotFill(node, ctx, accepted) {
    const slot = node.data?.slot;
    if (!slot || FORBIDDEN_KEYS.has(slot)) return;
    const entityKey = node.data?.entity ?? slot;
    if (ctx.entities && Object.hasOwn(ctx.entities, entityKey) && ctx.entities[entityKey] != null) {
      session.slots[slot] = ctx.entities[entityKey];
    } else if (accepted) {
      fillSlotFromIntent(slot, accepted);
    }
    ctx.slots = { ...session.slots };
  }

  // Fill a single named slot from its own from_intent mappings (scoped).
  function fillSlotFromIntent(slot, intentId) {
    const def = bundle.slots?.[slot];
    if (!def) return;
    for (const mapping of def.mappings || []) {
      if (mapping.type === 'from_intent' && intentMatches(mapping.intent, intentId)) {
        session.slots[slot] = 'value' in mapping ? mapping.value : intentId;
      }
    }
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
      if (FORBIDDEN_KEYS.has(name)) continue;
      for (const mapping of def.mappings || []) {
        if (mapping.type === 'from_intent' && intentMatches(mapping.intent, intentId)) {
          session.slots[name] = 'value' in mapping ? mapping.value : intentId;
        }
      }
    }
  }

  // Fill from_entity slots from caller-provided entities. Pure no-op when there
  // are no such mappings or no matching entity. Reads entities, never mutates it.
  function fillSlotsFromEntity(entities) {
    if (!entities) return;
    for (const [name, def] of Object.entries(bundle.slots || {})) {
      if (FORBIDDEN_KEYS.has(name)) continue;
      for (const mapping of def.mappings || []) {
        if (mapping.type !== 'from_entity') continue;
        const key = mapping.entity;
        if (Object.hasOwn(entities, key) && entities[key] != null) session.slots[name] = entities[key];
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
    if (FORBIDDEN_KEYS.has(name)) continue;
    slots[name] = 'initial_value' in def ? def.initial_value : null;
  }
  return slots;
}

function intentMatches(spec, intentId) {
  return Array.isArray(spec) ? spec.includes(intentId) : spec === intentId;
}

/**
 * Graph mode is active iff the bundle has a non-empty flow.nodes array.
 * @param {object} bundle
 * @returns {boolean}
 */
function isGraphMode(bundle) {
  return Boolean(bundle.flow && Array.isArray(bundle.flow.nodes) && bundle.flow.nodes.length > 0);
}

/**
 * Pick the start node: the data.type==='start' node, else the unique node with
 * no incoming edge, else fall soft to the first node (no runtime throw).
 * @param {object} flow
 * @returns {(string|null)}
 */
function startNodeId(flow) {
  const explicit = flow.nodes.find((node) => nodeKind(node) === 'start');
  if (explicit) return explicit.id;
  const targets = new Set((flow.edges || []).map((edge) => edge.target));
  const roots = flow.nodes.filter((node) => !targets.has(node.id));
  if (roots.length === 1) return roots[0].id;
  return flow.nodes[0]?.id ?? null;
}

function nodeById(flow, id) {
  return flow.nodes.find((node) => node.id === id);
}

function nodeKind(node) {
  return node.data?.type ?? node.type;
}

/**
 * First out-edge target of a node (default/sole edge), or null if none.
 * @param {object} node
 * @param {object} flow
 * @returns {(string|null)}
 */
function nextDefault(node, flow) {
  const edge = outEdges(node, flow)[0];
  return edge ? edge.target : null;
}

/**
 * Pick the first out-edge whose condition evaluates true; an edge with neither
 * condition nor intent shorthand is the default, chosen only if none matched.
 * @param {object} node
 * @param {object} ctx
 * @param {(string|null)} accepted Current-turn intent.
 * @param {object} flow
 * @returns {(object|null)}
 */
function pickEdge(node, ctx, accepted, flow) {
  const edges = outEdges(node, flow);
  let fallback = null;
  for (const edge of edges) {
    const condition = edgeCondition(edge);
    if (condition === undefined && edge.data?.intent === undefined) { fallback = fallback ?? edge; continue; }
    if (edge.data?.intent !== undefined) { if (edge.data.intent === accepted) return edge; continue; }
    if (evaluateCondition(condition, ctx)) return edge;
  }
  return fallback;
}

function edgeCondition(edge) {
  return edge.data?.condition;
}

function outEdges(node, flow) {
  return (flow.edges || []).filter((edge) => edge.source === node.id);
}

function messageText(node, lang) {
  return node.data?.i18n?.[lang]?.text ?? node.data?.text ?? '';
}

function branchFallback(node, lang) {
  const fallback = node.data?.fallback;
  if (fallback && typeof fallback === 'object') return fallback[lang] ?? fallback.en ?? '';
  return fallback ?? '';
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
