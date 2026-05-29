import { useRef } from 'react';

import { TEMPLATES } from '../lib/templates.js';

/**
 * Top action bar: start from a prebuilt template, import a bundle file,
 * export/validate the current build, and show the latest validation status.
 * Errors render as React text children only.
 *
 * @param {{
 *   onImportFile: (file: File) => void,
 *   onExport: () => void,
 *   onLoadTemplate: (id: string) => void,
 *   status: { kind: 'idle'|'ok'|'error', message: string, errors?: Array<{path:string,message:string}> }
 * }} props
 */
export function Toolbar({ onImportFile, onExport, onLoadTemplate, status }) {
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
      <strong>AI Call Center Builder</strong>
      <label className="template-picker">
        Start from template
        <select defaultValue="" onChange={handleTemplate} aria-label="Start from a prebuilt template">
          <option value="" disabled>
            Choose a template…
          </option>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => fileRef.current?.click()}>
        Import bundle
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
      <button type="button" onClick={onExport}>
        Export bundle
      </button>
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
