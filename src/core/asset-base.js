const SCRIPT_BASE_URL = detectScriptBaseUrl();

export function resolveAssetUrl(path, explicitUrl = null, baseUrl = SCRIPT_BASE_URL) {
  if (explicitUrl) return explicitUrl;
  if (baseUrl) return new URL(path, baseUrl).href;
  return path;
}

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
