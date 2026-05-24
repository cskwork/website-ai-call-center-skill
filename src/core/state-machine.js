const TRANSITIONS = Object.freeze({
  idle: ['preparing', 'listening', 'thinking', 'ended', 'error'],
  preparing: ['idle', 'listening', 'thinking', 'error', 'ended'],
  listening: ['thinking', 'idle', 'error', 'ended'],
  thinking: ['speaking', 'idle', 'error', 'ended'],
  speaking: ['idle', 'listening', 'error', 'ended'],
  error: ['idle', 'preparing', 'ended'],
  ended: ['idle', 'preparing'],
});

export function createCallStateMachine(onChange = () => {}) {
  let state = 'idle';

  function canTransition(next) {
    return next === state || TRANSITIONS[state]?.includes(next) === true;
  }

  function transition(next, meta = {}) {
    if (!canTransition(next)) {
      return { ok: false, state, reason: `${state} cannot transition to ${next}` };
    }
    const previous = state;
    state = next;
    onChange({ previous, state, meta });
    return { ok: true, previous, state };
  }

  return {
    getState: () => state,
    canTransition,
    transition,
    reset: () => transition('idle', { reason: 'reset' }),
  };
}
