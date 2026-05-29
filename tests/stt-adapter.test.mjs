import test from 'node:test';
import assert from 'node:assert/strict';

import { createWasmSttAdapter } from '../src/api.js';

/**
 * Minimal fake Worker: resolves prepare() by emitting `ready`, and counts
 * terminate() calls. No DOM / getUserMedia needed because we never call start().
 */
function makeFakeWorker(state) {
  return class FakeWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
    }

    postMessage(message) {
      if (message?.type === 'init') {
        // Reply asynchronously, after wireWorker has attached onmessage.
        setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 0);
      }
    }

    terminate() {
      state.terminated += 1;
    }
  };
}

test('destroy() terminates the prepared STT worker', async () => {
  const state = { terminated: 0 };
  const stt = createWasmSttAdapter({ WorkerCtor: makeFakeWorker(state), workerUrl: 'about:blank' });
  await stt.prepare();
  stt.destroy();
  assert.equal(state.terminated, 1, 'worker should be terminated exactly once');
});

test('destroy() is idempotent and safe before prepare()', () => {
  const state = { terminated: 0 };
  const stt = createWasmSttAdapter({ WorkerCtor: makeFakeWorker(state), workerUrl: 'about:blank' });
  // Never prepared: no worker yet, must not throw.
  assert.doesNotThrow(() => stt.destroy());
  assert.equal(state.terminated, 0);
});

test('destroy() after prepare() can be called repeatedly without re-terminating', async () => {
  const state = { terminated: 0 };
  const stt = createWasmSttAdapter({ WorkerCtor: makeFakeWorker(state), workerUrl: 'about:blank' });
  await stt.prepare();
  stt.destroy();
  stt.destroy();
  assert.equal(state.terminated, 1, 'second destroy is a no-op (worker already cleared)');
});

test('destroy() during a pending prepare() rejects it instead of hanging', async () => {
  // A worker that never replies `ready`, so prepare() stays pending until destroy.
  class SilentWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
    }
    postMessage() {}
    terminate() {}
  }
  const stt = createWasmSttAdapter({ WorkerCtor: SilentWorker, workerUrl: 'about:blank' });
  const pending = stt.prepare();
  stt.destroy();
  await assert.rejects(pending, /destroyed/);
});

test('the adapter exposes the prepare/start/stop/destroy contract', () => {
  const state = { terminated: 0 };
  const stt = createWasmSttAdapter({ WorkerCtor: makeFakeWorker(state), workerUrl: 'about:blank' });
  for (const method of ['prepare', 'start', 'stop', 'destroy']) {
    assert.equal(typeof stt[method], 'function', `${method} should be a function`);
  }
});
