// Pure, framework-free serialization between a config bundle's `flow` field and
// React Flow's runtime graph state. No React / @xyflow imports so node --test
// can exercise it directly. All operations deep-clone; inputs are never mutated.

const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 });

/**
 * Structured-clone wrapper that also tolerates the older Node builds; falls back
 * to JSON round-trip (graph payloads are plain JSON, so this is lossless here).
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Read a bundle's stored graph verbatim into React Flow state. When the bundle
 * has no flow (or an empty node set) an empty graph with the default viewport is
 * returned, so a fresh canvas renders cleanly.
 *
 * @param {object} bundle Config bundle (config-bundle.schema.json v2).
 * @returns {{ nodes: object[], edges: object[], viewport: {x:number,y:number,zoom:number} }}
 */
export function bundleToFlow(bundle) {
  const flow = bundle?.flow;
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  if (nodes.length === 0) {
    return { nodes: [], edges: [], viewport: { ...DEFAULT_VIEWPORT } };
  }
  return {
    nodes: clone(nodes).map(hydrateNodeType),
    edges: Array.isArray(flow.edges) ? clone(flow.edges) : [],
    viewport: flow.viewport ? clone(flow.viewport) : { ...DEFAULT_VIEWPORT },
  };
}

/**
 * React Flow and the inspector key off node.type, but the schema makes top-level
 * `type` optional (the runtime reads node.data.type). Hydrate type from data.type
 * on import so a data.type-only node renders with its custom component + fields.
 * @param {object} node
 * @returns {object}
 */
function hydrateNodeType(node) {
  if (node.type === undefined && node.data?.type) return { ...node, type: node.data.type };
  return node;
}

/**
 * Keep only the schema-relevant node fields {id, type, position:{x,y}, data},
 * dropping every React-Flow runtime-only field (selected, dragging, measured,
 * width, height, positionAbsolute, handle bounds, internals, etc.).
 * @param {object} node React Flow node.
 * @returns {object} Sanitized node safe to persist in bundle.flow.
 */
function sanitizeNode(node) {
  const out = {
    id: node.id,
    position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
    data: node.data ? clone(node.data) : {},
  };
  if (node.type !== undefined) out.type = node.type;
  return out;
}

/**
 * Normalize an edge's routing `data` into the SDK wire format the engine reads:
 * - A blank/whitespace-only `intent` or `condition` is NOT routing; it is dropped
 *   so the edge becomes the engine's default/fallback edge (a blank intent never
 *   matches and a blank condition cannot be evaluated, so either would otherwise
 *   produce a permanently dead edge).
 * - `condition` is the engine's evaluated expression, NOT text: a string is parsed
 *   to a JSON object (the inspector edits raw text); an already-parsed object is
 *   kept verbatim so re-exports round-trip. Unparseable JSON throws a friendly
 *   error so export can surface it instead of shipping an always-true string.
 *
 * @param {object} data Raw edge data from React Flow state.
 * @param {string} edgeId Edge id, for a locatable error message.
 * @returns {(object|undefined)} Cleaned data, or undefined when there is no routing.
 */
function normalizeEdgeData(data, edgeId) {
  if (data === undefined || data === null) return undefined;
  const cloned = clone(data);
  if (typeof cloned.intent === 'string' && cloned.intent.trim() === '') delete cloned.intent;
  if ('condition' in cloned) {
    cloned.condition = parseCondition(cloned.condition, edgeId);
    if (cloned.condition === undefined) delete cloned.condition;
  }
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

/**
 * Coerce an edge condition into the engine's expression object. Strings are the
 * inspector's editable form and must be parsed; objects pass through; blank text
 * means "no condition". Invalid JSON throws so export blocks instead of exporting
 * a string the engine would silently treat as always-true.
 * @param {*} condition
 * @param {string} edgeId
 * @returns {(object|undefined)}
 */
function parseCondition(condition, edgeId) {
  if (condition === undefined || condition === null) return undefined;
  if (typeof condition === 'object') return condition;
  if (typeof condition !== 'string') return condition;
  if (condition.trim() === '') return undefined;
  try {
    return JSON.parse(condition);
  } catch {
    throw new Error(`Edge "${edgeId}" has an invalid condition: it must be valid JSON.`);
  }
}

/**
 * Keep only {id, source, target, data} on an edge; data is omitted entirely
 * when absent so a default edge stays minimal. Strips selected, animated, style,
 * markerEnd, sourceHandle/targetHandle (single-handle nodes only in P3), etc.
 * The `condition` string is materialized into the engine's expression object.
 * @param {object} edge React Flow edge.
 * @returns {object} Sanitized edge safe to persist in bundle.flow.
 */
function sanitizeEdge(edge) {
  const out = { id: edge.id, source: edge.source, target: edge.target };
  const data = normalizeEdgeData(edge.data, edge.id);
  if (data !== undefined) out.data = data;
  return out;
}

/**
 * Build a NEW bundle whose `flow` is the sanitized graph. The base bundle and
 * the flow argument are never mutated (kept fields are deep-cloned). Runtime-only
 * React Flow fields are stripped so the export round-trips and validates.
 *
 * @param {object} baseBundle Existing bundle to clone metadata from.
 * @param {{ nodes?: object[], edges?: object[], viewport?: object }} flow React Flow graph.
 * @returns {object} New bundle = { ...baseBundle, flow: { nodes, edges, viewport } }.
 */
export function flowToBundle(baseBundle, flow) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes.map(sanitizeNode) : [];
  const edges = Array.isArray(flow?.edges) ? flow.edges.map(sanitizeEdge) : [];
  const viewport = flow?.viewport ? clone(flow.viewport) : { ...DEFAULT_VIEWPORT };
  return {
    ...clone(baseBundle ?? {}),
    flow: { nodes, edges, viewport },
  };
}
