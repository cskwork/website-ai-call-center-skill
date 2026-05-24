const ALLOWED_SELECTOR = /^(#[A-Za-z][\w:-]*|\.[A-Za-z][\w:-]*|\[data-[\w-]+(?:=["'][^"']+["'])?\])$/;

export function createSafeActionRegistry(initialActions = {}) {
  const actions = new Map();
  const api = { register, execute, list, has: (id) => actions.has(id) };
  Object.entries(initialActions).forEach(([id, run]) => register({ id, run }));

  function register(action) {
    if (!action?.id || typeof action.run !== 'function') {
      throw new TypeError('Safe actions require an id and run function.');
    }
    actions.set(action.id, { label: action.label || action.id, run: action.run });
    return api;
  }

  async function execute(action, context = {}) {
    const id = typeof action === 'string' ? action : action?.id;
    const entry = actions.get(id);
    if (!entry) return { ok: false, id, reason: 'unregistered_action' };
    await entry.run({ ...context, action });
    return { ok: true, id, label: entry.label };
  }

  function list() {
    return Array.from(actions, ([id, action]) => ({ id, label: action.label }));
  }

  return api;
}

export function createSelectorAction({ id, label, selector, behavior = 'highlight' }) {
  if (!ALLOWED_SELECTOR.test(selector)) throw new Error(`Unsafe selector for ${id}`);
  return { id, label, run: ({ document = globalThis.document }) => runSelectorAction(document, selector, behavior) };
}

function runSelectorAction(document, selector, behavior) {
  const node = document?.querySelector?.(selector);
  if (!node) return;
  if (behavior === 'scroll') node.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  if (behavior === 'highlight') highlight(node);
  if (behavior === 'focus') node.focus?.();
}

function highlight(node) {
  node.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  node.classList?.add('waicc-highlight');
  setTimeout(() => node.classList?.remove('waicc-highlight'), 1800);
}
