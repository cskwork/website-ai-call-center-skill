/**
 * Create a minimal pub/sub event bus. Supports a `'*'` wildcard listener. A
 * thrown listener is isolated so it cannot abort fan-out to other subscribers.
 *
 * @returns {{ on: (type: string, listener: (event: object) => void) => () => void,
 *   off: (type: string, listener: Function) => void,
 *   emit: (type: string, payload?: object) => object }}
 */
export function createEventBus() {
  const listeners = new Map();

  function on(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
    return () => off(type, listener);
  }

  function off(type, listener) {
    listeners.get(type)?.delete(listener);
  }

  function emit(type, payload = {}) {
    const event = { type, ...payload };
    notify(listeners.get(type), event);
    notify(listeners.get('*'), event);
    return event;
  }

  /**
   * @param {Set<Function>|undefined} set
   * @param {object} event
   */
  function notify(set, event) {
    for (const listener of set ?? []) {
      try { listener(event); } catch { /* isolate one bad subscriber from the rest */ }
    }
  }

  return { on, off, emit };
}
