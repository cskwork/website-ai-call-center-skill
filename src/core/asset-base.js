const SCRIPT_BASE_URL = detectScriptBaseUrl();

/**
 * Resolve an asset path against the SDK's script base URL, unless an explicit
 * URL is supplied. Falls back to the bare path when no base is known.
 *
 * @param {string} path Relative asset path.
 * @param {string|null} [explicitUrl] Fully-qualified override URL.
 * @param {string} [baseUrl] Base URL to resolve against.
 * @returns {string} The resolved asset URL.
 */
export function resolveAssetUrl(path, explicitUrl = null, baseUrl = SCRIPT_BASE_URL) {
  if (explicitUrl) return explicitUrl;
  if (baseUrl) return new URL(path, baseUrl).href;
  return path;
}

/**
 * Resolve the STT and TTS worker URLs against a base URL.
 *
 * @param {string} [baseUrl] Base URL (defaults to the script base or './').
 * @returns {{ sttWorkerUrl: string, ttsWorkerUrl: string }}
 */
export function createWorkerAssetUrls(baseUrl = SCRIPT_BASE_URL || './') {
  return {
    sttWorkerUrl: new URL('workers/stt-worker.js', baseUrl).href,
    ttsWorkerUrl: new URL('workers/tts-worker.js', baseUrl).href,
  };
}

function detectScriptBaseUrl() {
  const scriptUrl = globalThis.document?.currentScript?.src;
  return scriptUrl ? new URL('.', scriptUrl).href : '';
}
