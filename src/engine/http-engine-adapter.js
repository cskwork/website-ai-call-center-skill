export function createHttpEngineAdapter({ endpoint, fetchImpl = globalThis.fetch, headers = {}, timeoutMs = 20000 }) {
  if (!endpoint) throw new Error('HTTP engine requires an endpoint.');
  let sessionId = null;

  async function startSession(metadata = {}) {
    const result = await post(fetchImpl, endpoint, { type: 'start', metadata }, headers, timeoutMs);
    sessionId = result.sessionId || sessionId || `http-${Date.now().toString(36)}`;
    return { sessionId, ...result };
  }

  async function sendUserText(text, context = {}) {
    const result = await post(fetchImpl, endpoint, { type: 'message', sessionId, text, context }, headers, timeoutMs);
    return { text: result.text || '', actions: result.actions || [], sessionId: result.sessionId || sessionId };
  }

  async function endSession() {
    await post(fetchImpl, endpoint, { type: 'end', sessionId }, headers, timeoutMs).catch(() => null);
    sessionId = null;
  }

  return { startSession, sendUserText, endSession };
}

async function post(fetchImpl, endpoint, body, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP engine failed with ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}
