import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './FlowNode.jsx';

/**
 * Presentational React Flow wrapper. All graph state is owned by App and passed
 * down; this component only wires the library's default change handlers and the
 * selection callback that drives the inspector.
 *
 * @param {{
 *   nodes: object[], edges: object[],
 *   onNodesChange: Function, onEdgesChange: Function, onConnect: Function,
 *   onSelectionChange: Function
 * }} props
 */
export function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onSelectionChange }) {
  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
