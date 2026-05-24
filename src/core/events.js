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
    for (const listener of listeners.get(type) ?? []) listener(event);
    for (const listener of listeners.get('*') ?? []) listener(event);
    return event;
  }

  return { on, off, emit };
}
