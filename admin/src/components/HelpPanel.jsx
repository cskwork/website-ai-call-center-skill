import { useState } from 'react';

import { useI18n } from '../i18n/context.jsx';
import { NODE_KIND_LIST, nodeAccent, nodeDescription, nodeLabel } from '../i18n/node-content.js';

const STORAGE_KEY = 'waicc-admin-help-open';

/** Read whether the guide should start open. Defaults to open for first-time users. */
function initialOpen() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

/**
 * Collapsible "How it works" guide: a 4-step walkthrough plus a legend that
 * explains what every block does, in the active language. Open state persists so
 * returning users keep their choice. All text is rendered as React children.
 */
export function HelpPanel() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(initialOpen);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, next ? 'open' : 'closed');
      } catch {
        // Ignore persistence failures.
      }
      return next;
    });
  }

  return (
    <section className="help-panel">
      <button type="button" className="help-toggle" aria-expanded={open} onClick={toggle}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {open ? t('help.close') : t('help.toggle')}
      </button>
      {open && (
        <div className="help-body">
          <p className="help-intro">{t('help.intro')}</p>
          <ol className="help-steps">
            {['step1', 'step2', 'step3', 'step4'].map((step) => (
              <li key={step}>
                <strong>{t(`help.${step}.title`)}</strong>
                <span>{t(`help.${step}.body`)}</span>
              </li>
            ))}
          </ol>
          <h3 className="help-legend-title">{t('help.legendTitle')}</h3>
          <ul className="help-legend">
            {NODE_KIND_LIST.map((kind) => (
              <li key={kind}>
                <span className="legend-swatch" style={{ background: nodeAccent(kind) }} aria-hidden="true" />
                <span className="legend-text">
                  <strong>{nodeLabel(kind, locale)}</strong>
                  <span>{nodeDescription(kind, locale)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
