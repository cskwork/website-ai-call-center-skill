import { NODE_KIND_LIST, NODE_KINDS } from '../lib/node-kinds.js';

/**
 * @param {{ onAdd: (kind: string) => void }} props
 */
export function NodePalette({ onAdd }) {
  return (
    <aside className="palette">
      <h2>Add node</h2>
      {NODE_KIND_LIST.map((kind) => (
        <button key={kind} type="button" onClick={() => onAdd(kind)}>
          {NODE_KINDS[kind].label}
        </button>
      ))}
      <p className="hint">Click a node, then connect handles by dragging.</p>
    </aside>
  );
}
