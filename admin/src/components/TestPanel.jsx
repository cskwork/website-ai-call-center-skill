import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '../i18n/context.jsx';
import { mountTestCenter } from '../lib/test-center.js';

/**
 * Live test drawer. Builds the current flow into a bundle and mounts the real
 * assistant overlay so the user can talk to their flow without exporting. Typing
 * works instantly; the voice toggle swaps in the real WASM speech models (which
 * download on the overlay's Prepare step).
 *
 * The latest flow is read through a ref so editing the canvas does not remount
 * the overlay on every keystroke; use "Reload with current flow" to refresh.
 *
 * @param {{
 *   getTestBundle: () => ({ ok: true, bundle: object } | { ok: false, message?: string, errors?: Array<{path:string,message:string}> }),
 *   onClose: () => void
 * }} props
 */
export function TestPanel({ getTestBundle, onClose }) {
  const { t, locale } = useI18n();
  const containerRef = useRef(null);
  const centerRef = useRef(null);
  const getBundleRef = useRef(getTestBundle);
  getBundleRef.current = getTestBundle;

  const [voice, setVoice] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const teardown = useCallback(() => {
    // dispose() stops the mic + speech workers (voice mode) and removes the DOM.
    centerRef.current?.dispose?.();
    centerRef.current = null;
    containerRef.current?.replaceChildren();
    setReady(false);
  }, []);

  const build = useCallback(() => {
    teardown();
    const result = getBundleRef.current();
    if (!result.ok) {
      setError(result);
      return;
    }
    if ((result.bundle.flow?.nodes?.length ?? 0) === 0) {
      setError({ empty: true });
      return;
    }
    setError(null);
    centerRef.current = mountTestCenter({ bundle: result.bundle, locale, voice, mount: containerRef.current });
    setReady(true);
  }, [teardown, locale, voice]);

  // Rebuild on open and whenever locale or the voice mode changes.
  useEffect(() => {
    build();
    return teardown;
  }, [build, teardown]);

  function openAssistant() {
    /** @type {HTMLButtonElement|null} */
    const fab = containerRef.current?.querySelector('.waicc-fab') ?? null;
    fab?.click();
  }

  return (
    <section className="test-panel" aria-label={t('test.title')}>
      <header className="test-head">
        <strong>{t('test.title')}</strong>
        <button type="button" className="test-close" onClick={onClose}>
          {t('test.close')}
        </button>
      </header>
      <p className="hint">{t('test.intro')}</p>

      <label className="test-voice">
        <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> {t('test.voice')}
      </label>
      <p className="hint test-voice-hint">{t('test.voiceHelp')}</p>

      {error?.empty && <p className="banner banner-error">{t('test.empty')}</p>}
      {error && !error.empty && (
        <div className="banner banner-error">
          <div>{error.message ?? t('test.invalid')}</div>
          {error.errors && error.errors.length > 0 && (
            <ul className="error-list">
              {error.errors.map((err, i) => (
                <li key={`${err.path}-${i}`}>
                  {err.path}: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ready && (
        <div className="test-actions">
          <button type="button" onClick={openAssistant}>
            {t('test.open')}
          </button>
          <button type="button" onClick={build}>
            {t('test.rebuild')}
          </button>
        </div>
      )}
      {ready && <p className="banner banner-ok">{t('test.ready')}</p>}

      {/* The real overlay (FAB + dialog) mounts here; destroyed on close. */}
      <div ref={containerRef} className="test-mount" />
    </section>
  );
}
