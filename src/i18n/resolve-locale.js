import { UI_LOCALES, DEFAULT_LOCALE, UI_STRINGS } from './ui-strings.js';

/** @typedef {import('./ui-strings.js').UiStrings} UiStrings */

/**
 * Normalize a BCP-47-ish locale tag to one of the available locales.
 * Trims region/script subtags (`'ko-KR'` -> `'ko'`), is case-insensitive, and
 * safely accepts `undefined`/`null`. Returns `fallback` when no match is found.
 *
 * @param {string|null|undefined} requested Requested locale tag.
 * @param {readonly string[]} [available] Allowed locales.
 * @param {string} [fallback] Locale to use when nothing matches.
 * @returns {string} A locale guaranteed to be in `available` (or `fallback`).
 */
export function resolveLocale(requested, available = UI_LOCALES, fallback = DEFAULT_LOCALE) {
  if (typeof requested !== 'string') return fallback;
  const base = requested.trim().toLowerCase().split(/[-_]/)[0];
  if (!base) return fallback;
  return available.find((locale) => locale.toLowerCase() === base) ?? fallback;
}

/**
 * Build a complete, deeply frozen UI string set for a locale by deep-merging
 * EN fallback <- locale dictionary <- caller overrides. Pure: never mutates
 * inputs. Missing locale keys fall back to English.
 *
 * @param {string} locale Target locale (will be resolved against UI_LOCALES).
 * @param {Partial<UiStrings>} [overrides] Caller string overrides.
 * @returns {Readonly<UiStrings>} Frozen, fully-populated string set.
 */
export function createUiStrings(locale, overrides = {}) {
  const resolved = resolveLocale(locale);
  const merged = deepMerge(deepMerge(UI_STRINGS[DEFAULT_LOCALE], UI_STRINGS[resolved]), overrides || {});
  return deepFreeze(merged);
}

/**
 * Recursively merge plain-object sources into a new object. Scalar/array
 * values from `source` replace those in `base`; nested objects merge.
 *
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>} A new merged object.
 */
function deepMerge(base, source) {
  const result = { ...base };
  for (const [key, value] of Object.entries(source || {})) {
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? deepMerge(/** @type {Record<string, unknown>} */ (base[key]), value)
      : value;
  }
  return result;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively freeze an object and its nested plain-object values.
 *
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
  if (isPlainObject(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
  }
  return value;
}
