import { dataFieldsForKind, NODE_KINDS } from '../lib/node-kinds.js';
import { getPath } from '../lib/nested-data.js';

/**
 * Editor for the selected node's data fields (per NODE_KINDS) or the selected
 * edge's routing mode. All inputs are controlled and render values as text only.
 *
 * @param {{
 *   node: object|null,
 *   edge: object|null,
 *   onNodeField: (path: string, value: string) => void,
 *   onEdgeMode: (mode: 'none'|'intent'|'condition') => void,
 *   onEdgeValue: (mode: 'intent'|'condition', value: string) => void
 * }} props
 */
export function InspectorPanel({ node, edge, onNodeField, onEdgeMode, onEdgeValue }) {
  if (node) return <NodeInspector node={node} onNodeField={onNodeField} />;
  if (edge) return <EdgeInspector edge={edge} onEdgeMode={onEdgeMode} onEdgeValue={onEdgeValue} />;
  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      <p className="hint">Select a node or an edge to edit it.</p>
    </aside>
  );
}

function NodeInspector({ node, onNodeField }) {
  const kind = node.type;
  const fields = dataFieldsForKind(kind);
  const label = NODE_KINDS[kind]?.label ?? kind;
  return (
    <aside className="inspector">
      <h2>{label} node</h2>
      {fields.length === 0 && <p className="hint">This node has no editable fields.</p>}
      {fields.map((field) => {
        const value = getPath(node.data, field.key) ?? '';
        const id = `f_${field.key}`;
        return (
          <div className="field" key={field.key}>
            <label htmlFor={id}>
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            {field.input === 'textarea' ? (
              <textarea id={id} value={value} onChange={(e) => onNodeField(field.key, e.target.value)} />
            ) : (
              <input id={id} value={value} onChange={(e) => onNodeField(field.key, e.target.value)} />
            )}
          </div>
        );
      })}
    </aside>
  );
}

function edgeMode(edge) {
  if (edge.data?.intent !== undefined) return 'intent';
  if (edge.data?.condition !== undefined) return 'condition';
  return 'none';
}

/**
 * Render a condition for the textarea. An imported bundle stores the condition
 * as the engine's expression OBJECT; show it as JSON so editing it does not
 * overwrite the real expression with the literal "[object Object]". A raw string
 * (mid-edit) is shown verbatim.
 * @param {*} condition
 * @returns {string}
 */
function conditionText(condition) {
  if (condition === undefined || condition === null) return '';
  if (typeof condition === 'string') return condition;
  return JSON.stringify(condition, null, 2);
}

function EdgeInspector({ edge, onEdgeMode, onEdgeValue }) {
  const mode = edgeMode(edge);
  return (
    <aside className="inspector">
      <h2>Edge routing</h2>
      <div className="field">
        <label htmlFor="edge-mode">Routing mode</label>
        <select id="edge-mode" value={mode} onChange={(e) => onEdgeMode(e.target.value)}>
          <option value="none">Default (fallback)</option>
          <option value="intent">Match intent id</option>
          <option value="condition">Condition (raw JSON)</option>
        </select>
      </div>
      {mode === 'intent' && (
        <div className="field">
          <label htmlFor="edge-intent">Intent id</label>
          <input
            id="edge-intent"
            value={edge.data?.intent ?? ''}
            onChange={(e) => onEdgeValue('intent', e.target.value)}
          />
        </div>
      )}
      {mode === 'condition' && (
        <div className="field">
          <label htmlFor="edge-condition">Condition expression (JSON)</label>
          <textarea
            id="edge-condition"
            value={conditionText(edge.data?.condition)}
            onChange={(e) => onEdgeValue('condition', e.target.value)}
          />
        </div>
      )}
      <p className="hint">A default edge with no intent/condition is the fallback path.</p>
    </aside>
  );
}
