import { Handle, Position } from '@xyflow/react';
import { NODE_KIND_LIST, handlesForKind } from '../lib/node-kinds.js';
import { nodeAccent, nodeLabel } from '../i18n/node-content.js';
import { useI18n } from '../i18n/context.jsx';

/**
 * One-line summary of a node's data for the canvas. All values are rendered as
 * plain text children by the caller; this only assembles a string.
 * @param {string} kind
 * @param {object} data
 * @returns {string}
 */
function summarize(kind, data) {
  if (!data) return '';
  switch (kind) {
    case 'message':
    case 'handoff':
      return data.text || '';
    case 'intent-branch':
      return data.fallback ? `fallback: ${data.fallback}` : '';
    case 'slot-fill':
      return data.slot ? `slot: ${data.slot}` : '';
    case 'action':
      return data.actionId ? `${data.actionId} / ${data.label || ''}` : '';
    default:
      return '';
  }
}

/**
 * Custom React Flow node. `type` (the kind) is provided by React Flow via the
 * nodeTypes registration. The kind label is localized and a color accent helps
 * non-technical users tell blocks apart. Text is rendered exclusively through
 * React children (auto-escaped); dangerouslySetInnerHTML is never used.
 *
 * @param {{ type: string, data: object }} props
 */
function FlowNode({ type, data }) {
  const { locale } = useI18n();
  const kind = type;
  const handles = handlesForKind(kind);
  const showTarget = handles === 'target' || handles === 'both';
  const showSource = handles === 'source' || handles === 'both';
  const summary = summarize(kind, data);
  return (
    <div className="flow-node" style={{ borderLeftColor: nodeAccent(kind) }}>
      {showTarget && <Handle type="target" position={Position.Left} />}
      <div className="kind">{nodeLabel(kind, locale)}</div>
      {summary && <div className="summary">{summary}</div>}
      {showSource && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

/** nodeTypes map: every kind renders through the single FlowNode component. */
export const nodeTypes = Object.fromEntries(NODE_KIND_LIST.map((kind) => [kind, FlowNode]));
