import { LOCALES } from '../i18n/strings.js';
import { useI18n } from '../i18n/context.jsx';

/**
 * EN | KO segmented control. English is the default; the choice persists via the
 * i18n provider. Implemented as a group of toggle buttons (aria-pressed) rather
 * than ARIA radios, so the native button keyboard behavior (Tab to focus,
 * Space/Enter to activate) is honest and complete.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          className={locale === code ? 'lang-option active' : 'lang-option'}
          onClick={() => setLocale(code)}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
