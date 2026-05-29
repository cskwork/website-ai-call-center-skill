/**
 * Minimal example: drive a prebuilt industry template bundle through the
 * bundle-driven flow engine + overlay. Selects the template/locale from the URL
 * (?domain=finance&locale=en) so the same page can demo any pack. No framework,
 * no model download — keyword intent routing runs fully client-side.
 *
 * @typedef {typeof import('../../src/api.js')} WebsiteAICallCenterSdk
 */
const sdk = /** @type {WebsiteAICallCenterSdk} */ (/** @type {any} */ (window).WebsiteAICallCenter);

const params = new URLSearchParams(location.search);
const domain = (params.get('domain') || 'finance').replace(/[^a-z]/g, '');
const locale = params.get('locale') === 'ko' ? 'ko' : 'en';
const status = document.getElementById('status');

init().catch((error) => {
  status.textContent = `Error: ${error.message}`;
});

async function init() {
  const bundle = await loadBundle(domain);
  const center = sdk.createWebsiteCallCenter({
    title: bundle.tenant?.name ?? 'Assistant',
    locale,
    engine: sdk.createFlowEngine({ bundle, locale }),
  });

  syncSelectors();
  const open = document.getElementById('open');
  open.addEventListener('click', () => document.querySelector('.waicc-fab')?.click());
  open.disabled = false;
  status.textContent = `Loaded ${domain} template (${bundle.intents.length} intents, locale ${locale}). Click Open assistant.`;
  // Signal readiness for the e2e smoke and expose the instance for debugging.
  globalThis.__flowDemo = { ok: true, domain, locale, center };
}

/** @param {string} name */
async function loadBundle(name) {
  const response = await fetch(new URL(`../../bundles/${name}.bundle.json`, location.href));
  if (!response.ok) throw new Error(`Cannot load ${name} template bundle (${response.status}).`);
  return response.json();
}

// Reflect the active domain/locale and reload on change (each load is one
// fresh center, which keeps the example simple).
function syncSelectors() {
  const domainSel = document.getElementById('domain');
  const localeSel = document.getElementById('locale');
  domainSel.value = domain;
  localeSel.value = locale;
  const reload = () => {
    location.search = `?domain=${domainSel.value}&locale=${localeSel.value}`;
  };
  domainSel.addEventListener('change', reload);
  localeSel.addEventListener('change', reload);
}
