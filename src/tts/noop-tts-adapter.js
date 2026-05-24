export function createNoopTtsAdapter() {
  return {
    async prepare(report = () => {}) {
      report({ type: 'progress', area: 'tts', phase: 'ready', progress: 100, detail: 'No-op TTS ready' });
    },
    async speak() {},
    stop() {},
  };
}
