import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LOCALE, LOCALES, STRINGS } from './strings.js';

const STORAGE_KEY = 'waicc-admin-locale';

/** @typedef {'en'|'ko'} Locale */
/** @typedef {{ locale: Locale, setLocale: (l: Locale) => void, t: (key: string, fallback?: string) => string }} I18nValue */

const I18nContext = createContext(/** @type {I18nValue|null} */ (null));

/** Read the saved locale, defaulting to English. Safe when storage is unavailable. */
function initialLocale() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved && LOCALES.includes(/** @type {Locale} */ (saved))) return /** @type {Locale} */ (saved);
  } catch {
    // Private mode / disabled storage: fall back to the default.
  }
  return DEFAULT_LOCALE;
}

/**
 * Provides the active locale and a translate function. English is the default
 * and the fallback for any missing Korean key; an explicit `fallback` argument
 * wins only when the key is absent in both dictionaries.
 * @param {{ children: React.ReactNode }} props
 */
export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(initialLocale);

  // Keep <html lang> in sync with the active locale (including the saved value
  // restored on first load) so assistive tech announces the right language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next) => {
    const value = LOCALES.includes(next) ? next : DEFAULT_LOCALE;
    setLocaleState(value);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore persistence failures; the in-memory locale still updates.
    }
  }, []);

  const t = useCallback(
    (key, fallback) => {
      const value = STRINGS[locale]?.[key];
      if (value !== undefined) return value;
      const english = STRINGS[DEFAULT_LOCALE][key];
      if (english !== undefined) return english;
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active locale + translate function. Throws if used outside the
 * provider so the wiring mistake fails fast.
 * @returns {I18nValue}
 */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>.');
  return ctx;
}
