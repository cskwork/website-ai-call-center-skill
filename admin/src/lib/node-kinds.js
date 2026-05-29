// NODE_KINDS registry: the single source of truth for the 8 conversation-graph
// node kinds the runtime engine executes (src/engine/flow-engine.js). Each kind
// lists ONLY the data fields the engine reads, so the form panel and node
// factory stay in lock-step with runtime behavior. Framework-free (no React).

/**
 * @typedef {Object} FieldDescriptor
 * @property {string} key       Data-object key the engine reads (dot path for nested, e.g. 'i18n.ko.text').
 * @property {string} label     Human label shown in the inspector form.
 * @property {'text'|'textarea'} input  Control type for the inspector.
 * @property {boolean} [required] Whether the field is required for a usable node.
 */

/**
 * @typedef {Object} NodeKind
 * @property {string} kind     Engine kind string (also React Flow node.type and node.data.type).
 * @property {string} label    Palette/inspector label.
 * @property {'source'|'target'|'both'} handles  Which connection handles the node exposes.
 * @property {FieldDescriptor[]} fields  Editable data fields (empty for kinds with no data).
 */

/** @type {Record<string, NodeKind>} */
export const NODE_KINDS = Object.freeze({
  start: {
    kind: 'start',
    label: 'Start',
    handles: 'source',
    fields: [],
  },
  message: {
    kind: 'message',
    label: 'Message',
    handles: 'both',
    fields: [
      { key: 'text', label: 'Message text (EN)', input: 'textarea', required: true },
      { key: 'i18n.ko.text', label: 'Message text (KO)', input: 'textarea' },
    ],
  },
  'intent-branch': {
    kind: 'intent-branch',
    label: 'Intent branch',
    handles: 'both',
    fields: [
      { key: 'fallback', label: 'Fallback text (no match)', input: 'textarea' },
    ],
  },
  'slot-fill': {
    kind: 'slot-fill',
    label: 'Slot fill',
    handles: 'both',
    fields: [
      { key: 'slot', label: 'Slot name', input: 'text', required: true },
      { key: 'entity', label: 'Entity key (defaults to slot)', input: 'text' },
    ],
  },
  action: {
    kind: 'action',
    label: 'Action',
    handles: 'both',
    fields: [
      { key: 'actionId', label: 'Action id', input: 'text', required: true },
      { key: 'label', label: 'Action label', input: 'text', required: true },
    ],
  },
  'ai-disclosure': {
    kind: 'ai-disclosure',
    label: 'AI disclosure',
    handles: 'both',
    fields: [],
  },
  handoff: {
    kind: 'handoff',
    label: 'Handoff',
    handles: 'both',
    fields: [
      { key: 'text', label: 'Handoff text', input: 'textarea', required: true },
    ],
  },
  end: {
    kind: 'end',
    label: 'End',
    handles: 'target',
    fields: [],
  },
});

/** Ordered list of kind strings, for palette rendering. @type {string[]} */
export const NODE_KIND_LIST = Object.freeze(Object.keys(NODE_KINDS));

/**
 * Edge data fields. An edge with neither intent nor condition is the engine's
 * DEFAULT/fallback edge (src/engine/flow-engine.js pickEdge). intent and
 * condition are mutually exclusive: intent shorthand is matched before condition.
 * @type {{ none: string, intent: string, condition: string }}
 */
export const EDGE_MODES = Object.freeze({
  none: 'none',
  intent: 'intent',
  condition: 'condition',
});

/**
 * Default data object for a freshly created node of the given kind. Always sets
 * data.type so the engine's nodeKind() (node.data.type ?? node.type) resolves
 * even after the {id,type,position,data} sanitize.
 *
 * @param {string} kind One of NODE_KIND_LIST.
 * @returns {{ type: string } & Record<string, unknown>}
 */
export function makeDefaultNodeData(kind) {
  const data = { type: kind };
  switch (kind) {
    case 'message':
      data.text = '';
      break;
    case 'intent-branch':
      data.fallback = '';
      break;
    case 'slot-fill':
      data.slot = '';
      break;
    case 'action':
      data.actionId = '';
      data.label = '';
      break;
    case 'handoff':
      data.text = '';
      break;
    default:
      break;
  }
  return data;
}

/**
 * Field descriptors for a kind, or an empty array for an unknown kind.
 * @param {string} kind
 * @returns {FieldDescriptor[]}
 */
export function dataFieldsForKind(kind) {
  return NODE_KINDS[kind]?.fields ?? [];
}

/**
 * Which connection handles a kind exposes ('source' | 'target' | 'both').
 * @param {string} kind
 * @returns {'source'|'target'|'both'}
 */
export function handlesForKind(kind) {
  return NODE_KINDS[kind]?.handles ?? 'both';
}
