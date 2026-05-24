import test from 'node:test';
import assert from 'node:assert/strict';
import { createPiperTtsAdapter } from '../src/tts/piper-tts-adapter.js';

test('piper adapter reports explicit fallback when worker prepare fails', async () => {
  const events = [];
  let fallbackPrepared = false;
  const adapter = createPiperTtsAdapter({
    WorkerCtor: class BrokenWorker { constructor() { throw new Error('worker blocked'); } },
    fallback: {
      async prepare() { fallbackPrepared = true; },
      async speak() {},
      stop() {},
    },
  });

  await adapter.prepare((event) => events.push(event));

  assert.equal(fallbackPrepared, true);
  assert.equal(events.some((event) => event.area === 'tts' && event.phase === 'fallback'), true);
});


test('piper adapter speaks fallback after async worker init failure', async () => {
  const events = [];
  const spoken = [];
  class AsyncBrokenWorker {
    constructor() { this.onmessage = null; }
    postMessage(message) {
      if (message.type === 'init') {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'error', id: null, message: 'model failed' } }));
      }
    }
    terminate() {}
  }
  const adapter = createPiperTtsAdapter({
    WorkerCtor: AsyncBrokenWorker,
    fallback: {
      async prepare() {},
      async speak(text) { spoken.push(text); },
      stop() {},
    },
  });

  await adapter.prepare((event) => events.push(event));
  await adapter.speak('hello fallback');

  assert.deepEqual(spoken, ['hello fallback']);
  assert.equal(events.some((event) => event.area === 'tts' && event.phase === 'fallback'), true);
});

test('piper adapter default fallback does not require browser speech api', async () => {
  const adapter = createPiperTtsAdapter({
    WorkerCtor: class BrokenWorker {
      constructor() {
        throw new Error('worker unavailable');
      }
    },
  });

  await adapter.prepare(() => {});
  await adapter.speak('silent fallback');
});
