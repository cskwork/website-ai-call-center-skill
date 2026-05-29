// Factory for new graph elements. Kept out of React components so id and
// default-data generation are pure and node-testable. crypto.randomUUID exists
// in Node 18+ and all current browsers.

import { makeDefaultNodeData } from './node-kinds.js';

/**
 * Generate a short unique id with a kind/edge prefix for readability.
 * @param {string} prefix
 * @returns {string}
 */
function uid(prefix) {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

/**
 * Create a new React Flow node for the given kind. Sets BOTH node.type and
 * node.data.type to the kind so the custom component renders and the engine's
 * nodeKind() resolves after sanitize. Position is a plain {x,y} clone.
 *
 * @param {string} kind One of NODE_KIND_LIST.
 * @param {{ x: number, y: number }} position Canvas position.
 * @returns {{ id: string, type: string, position: {x:number,y:number}, data: object }}
 */
export function createNode(kind, position) {
  return {
    id: uid(kind),
    type: kind,
    position: { x: position?.x ?? 0, y: position?.y ?? 0 },
    data: makeDefaultNodeData(kind),
  };
}

/**
 * Create a new default (unconditioned) edge between two nodes. Edge mode
 * (intent / condition) is applied later via the inspector.
 *
 * @param {string} source Source node id.
 * @param {string} target Target node id.
 * @returns {{ id: string, source: string, target: string }}
 */
export function createEdge(source, target) {
  return { id: uid('edge'), source, target };
}
