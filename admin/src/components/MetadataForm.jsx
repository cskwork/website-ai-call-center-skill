import { useI18n } from '../i18n/context.jsx';
import { Tooltip } from './Tooltip.jsx';

const DOMAINS = ['finance', 'education', 'insurance', 'support', 'custom'];
const RESOLVERS = ['keyword', 'embedding', 'zeroshot', 'setfit'];
const SHOW_ON = ['first-interaction', 'every-session', 'off'];

/**
 * Minimal bundle-metadata form. The graph is the P3 novelty, so intents[] and
 * scenarios[] are edited as raw JSON (parse errors surfaced) rather than
 * structured forms. All updates are emitted immutably to the parent. Labels and
 * help are localized; option values stay engine-stable.
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
  const { t } = useI18n();
  const tenant = bundle.tenant ?? {};
  const intentModel = bundle.intentModel ?? {};
  const disclosure = bundle.disclosure ?? {};

  return (
    <div className="metadata">
      <h2>{t('meta.tenant')}</h2>
      <Text label={t('meta.tenantId')} help={t('meta.tenantIdHelp')} value={tenant.id ?? ''} onChange={(v) => onPatch({ tenant: { ...tenant, id: v } })} />
      <Text label={t('meta.tenantName')} help={t('meta.tenantNameHelp')} value={tenant.name ?? ''} onChange={(v) => onPatch({ tenant: { ...tenant, name: v } })} />
      <Text
        label={t('meta.locales')}
        help={t('meta.localesHelp')}
        value={(tenant.locales ?? []).join(', ')}
        onChange={(v) => onPatch({ tenant: { ...tenant, locales: splitList(v) } })}
      />

      <h2>{t('meta.domain')}</h2>
      <Select label={t('meta.domainLabel')} help={t('meta.domainHelp')} value={bundle.domain ?? 'custom'} options={optionList(DOMAINS, t)} onChange={(v) => onPatch({ domain: v })} />
      <Select
        label={t('meta.resolver')}
        help={t('meta.resolverHelp')}
        value={intentModel.resolver ?? 'keyword'}
        options={optionList(RESOLVERS, t)}
        onChange={(v) => onPatch({ intentModel: { ...intentModel, resolver: v } })}
      />
      <Text
        label={t('meta.threshold')}
        help={t('meta.thresholdHelp')}
        value={intentModel.threshold ?? ''}
        onChange={(v) => onPatch({ intentModel: { ...intentModel, threshold: toNumber(v) } })}
      />

      <h2>
        {t('meta.disclosure')}
        <Tooltip content={t('meta.disclosureHelp')} label={t('meta.disclosure')} />
      </h2>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={Boolean(disclosure.required)}
            onChange={(e) => onPatch({ disclosure: { ...disclosure, required: e.target.checked } })}
          />{' '}
          {t('meta.required')}
        </label>
      </div>
      <Select
        label={t('meta.showOn')}
        value={disclosure.showOn ?? 'first-interaction'}
        options={optionList(SHOW_ON, t)}
        onChange={(v) => onPatch({ disclosure: { ...disclosure, showOn: v } })}
      />
      <Area
        label={t('meta.disclosureText')}
        value={disclosure.text?.en ?? ''}
        onChange={(v) => onPatch({ disclosure: { ...disclosure, text: { ...disclosure.text, en: v } } })}
      />

      <h2>
        {t('meta.intents')}
        <Tooltip content={t('meta.intentsHelp')} label={t('meta.intents')} />
      </h2>
      <JsonArea value={jsonText.intents} error={jsonError.intents} onChange={(text) => onJsonChange('intents', text)} />

      <h2>
        {t('meta.scenarios')}
        <Tooltip content={t('meta.scenariosHelp')} label={t('meta.scenarios')} />
      </h2>
      <JsonArea value={jsonText.scenarios} error={jsonError.scenarios} onChange={(text) => onJsonChange('scenarios', text)} />
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

/**
 * Build localized {value,label} options for a select. The value stays the engine
 * id; only the visible label is translated (falling back to the id).
 * @param {string[]} values
 * @param {(key: string, fallback?: string) => string} t
 */
function optionList(values, t) {
  return values.map((value) => ({ value, label: t(`meta.opt.${value}`, value) }));
}

/**
 * Label + optional help tooltip, rendered as siblings (not the tooltip inside the
 * <label>, which would forward clicks to the labelled control).
 */
function FieldHead({ label, help }) {
  return (
    <div className="field-head">
      <label>{label}</label>
      {help && <Tooltip content={help} label={label} />}
    </div>
  );
}

function Text({ label, value, onChange, help }) {
  return (
    <div className="field">
      <FieldHead label={label} help={help} />
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, help }) {
  return (
    <div className="field">
      <FieldHead label={label} help={help} />
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, options, onChange, help }) {
  return (
    <div className="field">
      <FieldHead label={label} help={help} />
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(({ value: optValue, label: optLabel }) => (
          <option key={optValue} value={optValue}>
            {optLabel}
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
