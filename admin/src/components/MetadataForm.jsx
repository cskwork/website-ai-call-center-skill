const DOMAINS = ['finance', 'education', 'insurance', 'support', 'custom'];
const RESOLVERS = ['keyword', 'embedding', 'zeroshot', 'setfit'];
const SHOW_ON = ['first-interaction', 'every-session', 'off'];

/**
 * Minimal bundle-metadata form. The graph is the P3 novelty, so intents[] and
 * scenarios[] are edited as raw JSON (parse errors surfaced) rather than
 * structured forms. All updates are emitted immutably to the parent.
 *
 * @param {{
 *   bundle: object,
 *   jsonText: { intents: string, scenarios: string },
 *   jsonError: { intents: string|null, scenarios: string|null },
 *   onPatch: (patch: object) => void,
 *   onJsonChange: (key: 'intents'|'scenarios', text: string) => void
 * }} props
 */
export function MetadataForm({ bundle, jsonText, jsonError, onPatch, onJsonChange }) {
  const tenant = bundle.tenant ?? {};
  const intentModel = bundle.intentModel ?? {};
  const disclosure = bundle.disclosure ?? {};

  return (
    <div className="metadata">
      <h2>Tenant</h2>
      <Text label="Tenant id" value={tenant.id ?? ''} onChange={(v) => onPatch({ tenant: { ...tenant, id: v } })} />
      <Text label="Tenant name" value={tenant.name ?? ''} onChange={(v) => onPatch({ tenant: { ...tenant, name: v } })} />
      <Text
        label="Locales (comma-separated)"
        value={(tenant.locales ?? []).join(', ')}
        onChange={(v) => onPatch({ tenant: { ...tenant, locales: splitList(v) } })}
      />

      <h2>Domain &amp; intent model</h2>
      <Select label="Domain" value={bundle.domain ?? 'custom'} options={DOMAINS} onChange={(v) => onPatch({ domain: v })} />
      <Select
        label="Resolver"
        value={intentModel.resolver ?? 'keyword'}
        options={RESOLVERS}
        onChange={(v) => onPatch({ intentModel: { ...intentModel, resolver: v } })}
      />
      <Text
        label="Threshold (0-1)"
        value={intentModel.threshold ?? ''}
        onChange={(v) => onPatch({ intentModel: { ...intentModel, threshold: toNumber(v) } })}
      />

      <h2>Disclosure</h2>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={Boolean(disclosure.required)}
            onChange={(e) => onPatch({ disclosure: { ...disclosure, required: e.target.checked } })}
          />{' '}
          Required
        </label>
      </div>
      <Select
        label="Show on"
        value={disclosure.showOn ?? 'first-interaction'}
        options={SHOW_ON}
        onChange={(v) => onPatch({ disclosure: { ...disclosure, showOn: v } })}
      />
      <Area
        label="Disclosure text (EN)"
        value={disclosure.text?.en ?? ''}
        onChange={(v) => onPatch({ disclosure: { ...disclosure, text: { ...disclosure.text, en: v } } })}
      />

      <h2>Intents (JSON)</h2>
      <JsonArea value={jsonText.intents} error={jsonError.intents} onChange={(t) => onJsonChange('intents', t)} />

      <h2>Scenarios (JSON)</h2>
      <JsonArea value={jsonText.scenarios} error={jsonError.scenarios} onChange={(t) => onJsonChange('scenarios', t)} />
    </div>
  );
}

function splitList(text) {
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

function toNumber(text) {
  const n = Number(text);
  return text === '' || Number.isNaN(n) ? undefined : n;
}

function Text({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function JsonArea({ value, error, onChange }) {
  return (
    <div className="field">
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} />
      {error && <div className="banner banner-error">{error}</div>}
    </div>
  );
}
