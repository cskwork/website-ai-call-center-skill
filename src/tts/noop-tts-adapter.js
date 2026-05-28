/**
 * Create a no-op TTS adapter that reports ready and silently swallows speech.
 * Serves as the safe default and as the Piper fallback when WASM is degraded.
 *
 * @returns {{ prepare: (report?: Function) => Promise<void>, speak: () => Promise<void>, stop: () => void }}
 */
export function createNoopTtsAdapter() {
  return {
    async prepare(report = () => {}) {
      report({ type: 'progress', area: 'tts', phase: 'ready', progress: 100, detail: 'No-op TTS ready' });
    },
    async speak() {},
    stop() {},
  };
}
