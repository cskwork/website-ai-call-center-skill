/**
 * Create a no-op STT adapter that returns a canned transcript. Useful for
 * tests, text-only deployments, and as a safe default.
 *
 * @param {object} [options]
 * @param {string} [options.transcript] Transcript returned by `stop()`.
 * @returns {{ prepare: (report?: Function) => Promise<void>,
 *   start: (listener?: Function) => Promise<void>,
 *   stop: () => Promise<{ text: string, final: boolean, source: string }> }}
 */
export function createNoopSttAdapter({ transcript = 'I need help with this page.' } = {}) {
  let onTranscript = null;

  return {
    async prepare(report = () => {}) {
      report({ type: 'progress', area: 'stt', phase: 'ready', progress: 100, detail: 'No-op STT ready' });
    },
    async start(listener = () => {}) {
      onTranscript = listener;
      listener({ text: '', final: false, source: 'noop-stt' });
    },
    async stop() {
      const result = { text: transcript, final: true, source: 'noop-stt' };
      onTranscript?.(result);
      return result;
    },
  };
}
