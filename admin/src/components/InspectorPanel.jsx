import { dataFieldsForKind } from '../lib/node-kinds.js';
import { getPath } from '../lib/nested-data.js';
import { fieldHelp, fieldLabel, nodeDescription, nodeLabel } from '../i18n/node-content.js';
import { useI18n } from '../i18n/context.jsx';
import { Tooltip } from './Tooltip.jsx';

/**
 * Editor for the selected node's data fields (per NODE_KINDS) or the selected
 * edge's routing mode. All inputs are controlled and render values as text only.
 * Labels and help are localized; node kind ids stay engine-stable.
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
  const { t } = useI18n();
  if (node) return <NodeInspector node={node} onNodeField={onNodeField} />;
  if (edge) return <EdgeInspector edge={edge} onEdgeMode={onEdgeMode} onEdgeValue={onEdgeValue} />;
  return (
    <aside className="inspector">
      <h2>{t('inspector.title')}</h2>
      <p className="hint">{t('inspector.empty')}</p>
    </aside>
  );
}

function NodeInspector({ node, onNodeField }) {
  const { t, locale } = useI18n();
  const kind = node.type;
  const fields = dataFieldsForKind(kind);
  return (
    <aside className="inspector">
      <h2>
        {nodeLabel(kind, locale)} {t('inspector.nodeSuffix')}
      </h2>
      <p className="hint inspector-desc">{nodeDescription(kind, locale)}</p>
      {fields.length === 0 && <p className="hint">{t('inspector.noFields')}</p>}
      {fields.map((field) => {
        const value = getPath(node.data, field.key) ?? '';
        const id = `f_${field.key}`;
        const help = fieldHelp(kind, field.key, locale);
        return (
          <div className="field" key={field.key}>
            <div className="field-head">
              <label htmlFor={id}>
                {fieldLabel(kind, field, locale)}
                {field.required ? ` (${t('inspector.required')})` : ''}
              </label>
              {help && <Tooltip content={help} label={fieldLabel(kind, field, locale)} />}
            </div>
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
  const { t } = useI18n();
  const mode = edgeMode(edge);
  return (
    <aside className="inspector">
      <h2>{t('edge.title')}</h2>
      <p className="hint inspector-desc">{t('edge.intro')}</p>
      <div className="field">
        <div className="field-head">
          <label htmlFor="edge-mode">{t('edge.mode')}</label>
          <Tooltip content={t('edge.modeHelp')} label={t('edge.mode')} />
        </div>
        <select id="edge-mode" value={mode} onChange={(e) => onEdgeMode(e.target.value)}>
          <option value="none">{t('edge.mode.none')}</option>
          <option value="intent">{t('edge.mode.intent')}</option>
          <option value="condition">{t('edge.mode.condition')}</option>
        </select>
      </div>
      {mode === 'intent' && (
        <div className="field">
          <div className="field-head">
            <label htmlFor="edge-intent">{t('edge.intentLabel')}</label>
            <Tooltip content={t('edge.intentHelp')} label={t('edge.intentLabel')} />
          </div>
          <input
            id="edge-intent"
            value={edge.data?.intent ?? ''}
            onChange={(e) => onEdgeValue('intent', e.target.value)}
          />
        </div>
      )}
      {mode === 'condition' && (
        <div className="field">
          <div className="field-head">
            <label htmlFor="edge-condition">{t('edge.conditionLabel')}</label>
            <Tooltip content={t('edge.conditionHelp')} label={t('edge.conditionLabel')} />
          </div>
          <textarea
            id="edge-condition"
            value={conditionText(edge.data?.condition)}
            onChange={(e) => onEdgeValue('condition', e.target.value)}
          />
        </div>
      )}
      <p className="hint">{t('edge.hint')}</p>
    </aside>
  );
}
