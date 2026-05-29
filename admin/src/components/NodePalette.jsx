import { NODE_KIND_LIST } from '../lib/node-kinds.js';
import { nodeAccent, nodeDescription, nodeLabel } from '../i18n/node-content.js';
import { useI18n } from '../i18n/context.jsx';
import { Tooltip } from './Tooltip.jsx';
import { HelpPanel } from './HelpPanel.jsx';

/**
 * Left rail: a labelled, color-coded button per node kind (each with a
 * plain-language tooltip) plus the collapsible "How it works" guide. Clicking a
 * button adds that block to the canvas.
 *
 * @param {{ onAdd: (kind: string) => void }} props
 */
export function NodePalette({ onAdd }) {
  const { t, locale } = useI18n();
  return (
    <aside className="palette">
      <h2 className="palette-title">
        {t('palette.title')}
        <Tooltip content={t('palette.help')} label={t('palette.title')} />
      </h2>
      <p className="hint">{t('palette.subtitle')}</p>

      <div className="palette-blocks">
        {NODE_KIND_LIST.map((kind) => (
          <div className="palette-row" key={kind}>
            <button type="button" className="palette-block" onClick={() => onAdd(kind)}>
              <span className="block-swatch" style={{ background: nodeAccent(kind) }} aria-hidden="true" />
              {nodeLabel(kind, locale)}
            </button>
            <Tooltip content={nodeDescription(kind, locale)} label={nodeLabel(kind, locale)} />
          </div>
        ))}
      </div>

      <p className="hint">{t('palette.hint')}</p>
      <HelpPanel />
    </aside>
  );
}
