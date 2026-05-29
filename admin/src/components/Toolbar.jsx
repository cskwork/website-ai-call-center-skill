import { useRef } from 'react';

import { TEMPLATES } from '../lib/templates.js';
import { useI18n } from '../i18n/context.jsx';
import { Tooltip } from './Tooltip.jsx';
import { LanguageToggle } from './LanguageToggle.jsx';

/**
 * Top action bar: start from a prebuilt template, import a bundle file, test the
 * flow live, export/validate the current build, switch language, and show the
 * latest validation status. Errors render as React text children only.
 *
 * @param {{
 *   onImportFile: (file: File) => void,
 *   onExport: () => void,
 *   onLoadTemplate: (id: string) => void,
 *   onOpenTest: () => void,
 *   status: { kind: 'idle'|'ok'|'error', message: string, errors?: Array<{path:string,message:string}> }
 * }} props
 */
export function Toolbar({ onImportFile, onExport, onLoadTemplate, onOpenTest, status }) {
  const { t } = useI18n();
  const fileRef = useRef(null);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (file) onImportFile(file);
    event.target.value = ''; // allow re-importing the same filename
  }

  function handleTemplate(event) {
    const id = event.target.value;
    if (id) onLoadTemplate(id);
    event.target.value = ''; // reset so re-picking the same template reloads it
  }

  return (
    <header className="toolbar">
      <strong className="brand">{t('app.title')}</strong>

      <label className="template-picker">
        {t('toolbar.template')}
        <select defaultValue="" onChange={handleTemplate} aria-label={t('toolbar.template')}>
          <option value="" disabled>
            {t('toolbar.templatePlaceholder')}
          </option>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <Tooltip content={t('toolbar.templateHelp')} label={t('toolbar.template')} />
      </label>

      <span className="toolbar-action">
        <button type="button" onClick={() => fileRef.current?.click()}>
          {t('toolbar.import')}
        </button>
        <Tooltip content={t('toolbar.importHelp')} label={t('toolbar.import')} />
      </span>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />

      <span className="toolbar-action">
        <button type="button" className="btn-primary" onClick={onOpenTest}>
          {t('toolbar.test')}
        </button>
        <Tooltip content={t('toolbar.testHelp')} label={t('toolbar.test')} />
      </span>

      <span className="toolbar-action">
        <button type="button" onClick={onExport}>
          {t('toolbar.export')}
        </button>
        <Tooltip content={t('toolbar.exportHelp')} label={t('toolbar.export')} />
      </span>

      <LanguageToggle />
      <StatusBanner status={status} />
    </header>
  );
}

function StatusBanner({ status }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'ok') {
    return <span className="banner banner-ok">{status.message}</span>;
  }
  return (
    <div className="banner banner-error">
      <div>{status.message}</div>
      {status.errors && status.errors.length > 0 && (
        <ul className="error-list">
          {status.errors.map((err, i) => (
            <li key={`${err.path}-${i}`}>
              {err.path}: {err.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
