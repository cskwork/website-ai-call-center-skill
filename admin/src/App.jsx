import { useCallback, useMemo, useState } from 'react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';

import { Toolbar } from './components/Toolbar.jsx';
import { NodePalette } from './components/NodePalette.jsx';
import { FlowCanvas } from './components/FlowCanvas.jsx';
import { InspectorPanel } from './components/InspectorPanel.jsx';
import { MetadataForm } from './components/MetadataForm.jsx';

import { makeEmptyBundle } from './lib/empty-bundle.js';
import { templateBundle } from './lib/templates.js';
import { bundleToFlow, flowToBundle } from './lib/flow-bundle.js';
import { validateBundle } from './lib/validate-bundle.js';
import { createNode, createEdge } from './lib/node-factory.js';
import { setPath } from './lib/nested-data.js';
import { downloadJson, readJsonFile } from './lib/download-json.js';

const INITIAL_BUNDLE = makeEmptyBundle();

/** Build the editable JSON-text mirror of intents/scenarios from a bundle. */
function jsonTextFor(bundle) {
  return {
    intents: JSON.stringify(bundle.intents ?? [], null, 2),
    scenarios: JSON.stringify(bundle.scenarios ?? [], null, 2),
  };
}

export function App() {
  const initialFlow = useMemo(() => bundleToFlow(INITIAL_BUNDLE), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);
  const [meta, setMeta] = useState(INITIAL_BUNDLE);
  const [jsonText, setJsonText] = useState(() => jsonTextFor(INITIAL_BUNDLE));
  const [jsonError, setJsonError] = useState({ intents: null, scenarios: null });
  const [selection, setSelection] = useState({ node: null, edge: null });
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(createEdge(connection.source, connection.target), eds)),
    [setEdges],
  );

  const addNode = useCallback(
    (kind) => setNodes((nds) => [...nds, createNode(kind, { x: 80 + nds.length * 20, y: 80 + nds.length * 20 })]),
    [setNodes],
  );

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    setSelection({ node: selNodes?.[0] ?? null, edge: selEdges?.[0] ?? null });
  }, []);

  // Immutable node-data patch by dot path; also refresh selection so the form
  // shows the updated value.
  const onNodeField = useCallback(
    (path, value) => {
      const id = selection.node?.id;
      if (!id) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: setPath(n.data, path, value) } : n)),
      );
      setSelection((sel) =>
        sel.node?.id === id ? { ...sel, node: { ...sel.node, data: setPath(sel.node.data, path, value) } } : sel,
      );
    },
    [selection.node, setNodes],
  );

  // Edge routing: intent and condition are mutually exclusive; switching mode
  // clears the other field. mode 'none' removes both (default/fallback edge).
  const patchEdge = useCallback(
    (id, nextData) => {
      const data = nextData && Object.keys(nextData).length > 0 ? nextData : undefined;
      setEdges((eds) => eds.map((e) => (e.id === id ? withData(e, data) : e)));
      setSelection((sel) => (sel.edge?.id === id ? { ...sel, edge: withData(sel.edge, data) } : sel));
    },
    [setEdges],
  );

  const onEdgeMode = useCallback(
    (mode) => {
      const id = selection.edge?.id;
      if (!id) return;
      if (mode === 'intent') patchEdge(id, { intent: '' });
      else if (mode === 'condition') patchEdge(id, { condition: '' });
      else patchEdge(id, undefined);
    },
    [selection.edge, patchEdge],
  );

  const onEdgeValue = useCallback(
    (mode, value) => {
      const id = selection.edge?.id;
      if (!id) return;
      patchEdge(id, { [mode]: value });
    },
    [selection.edge, patchEdge],
  );

  const onMetaPatch = useCallback((patch) => setMeta((b) => ({ ...b, ...patch })), []);

  const onJsonChange = useCallback((key, text) => {
    setJsonText((t) => ({ ...t, [key]: text }));
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.');
      setJsonError((e) => ({ ...e, [key]: null }));
      setMeta((b) => ({ ...b, [key]: parsed }));
    } catch (err) {
      setJsonError((e) => ({ ...e, [key]: err.message }));
    }
  }, []);

  const buildBundle = useCallback(
    () => flowToBundle(meta, { nodes, edges, viewport: meta.flow?.viewport ?? { x: 0, y: 0, zoom: 1 } }),
    [meta, nodes, edges],
  );

  const onExport = useCallback(() => {
    if (jsonError.intents || jsonError.scenarios) {
      setStatus({ kind: 'error', message: 'Fix the JSON errors in intents/scenarios before exporting.' });
      return;
    }
    let bundle;
    try {
      bundle = buildBundle();
    } catch (err) {
      // flowToBundle throws when a condition edge holds unparseable JSON; block
      // export so an always-true condition string never ships.
      setStatus({ kind: 'error', message: err.message });
      return;
    }
    const result = validateBundle(bundle);
    if (!result.valid) {
      setStatus({ kind: 'error', message: 'Bundle is not valid. Fix these and try again:', errors: result.errors });
      return;
    }
    downloadJson(`${bundle.tenant?.id ?? 'tenant'}.bundle.json`, bundle);
    setStatus({ kind: 'ok', message: 'Bundle validated and downloaded.' });
  }, [buildBundle, jsonError]);

  // Replace the whole canvas + metadata from a validated bundle. Shared by file
  // import and the prebuilt starter templates.
  const loadBundle = useCallback(
    (parsed, okMessage, invalidMessage) => {
      const result = validateBundle(parsed);
      if (!result.valid) {
        setStatus({ kind: 'error', message: invalidMessage, errors: result.errors });
        return;
      }
      const flow = bundleToFlow(parsed);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setMeta(parsed);
      setJsonText(jsonTextFor(parsed));
      setJsonError({ intents: null, scenarios: null });
      setSelection({ node: null, edge: null });
      setStatus({ kind: 'ok', message: okMessage });
    },
    [setNodes, setEdges],
  );

  const onImportFile = useCallback(
    async (file) => {
      try {
        const parsed = await readJsonFile(file);
        loadBundle(parsed, 'Bundle imported.', 'Imported file is not a valid bundle:');
      } catch (err) {
        setStatus({ kind: 'error', message: err.message });
      }
    },
    [loadBundle],
  );

  // Start from a prebuilt working flow. Deep-clone so the imported template module
  // is never mutated by subsequent edits.
  const onLoadTemplate = useCallback(
    (id) => {
      const bundle = templateBundle(id);
      if (!bundle) return;
      loadBundle(structuredClone(bundle), `Loaded the ${id} template. Edit and export when ready.`, 'Template is not valid:');
    },
    [loadBundle],
  );

  return (
    <div className="app">
      <Toolbar onImportFile={onImportFile} onExport={onExport} onLoadTemplate={onLoadTemplate} status={status} />
      <div className="workspace">
        <NodePalette onAdd={addNode} />
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
        />
        <div className="inspector-column">
          <InspectorPanel
            node={selection.node}
            edge={selection.edge}
            onNodeField={onNodeField}
            onEdgeMode={onEdgeMode}
            onEdgeValue={onEdgeValue}
          />
          <MetadataForm
            bundle={meta}
            jsonText={jsonText}
            jsonError={jsonError}
            onPatch={onMetaPatch}
            onJsonChange={onJsonChange}
          />
        </div>
      </div>
    </div>
  );
}

/** Return a new edge with data set (or removed when undefined). */
function withData(edge, data) {
  if (data === undefined) {
    const { data: _omit, ...rest } = edge;
    return rest;
  }
  return { ...edge, data };
}
