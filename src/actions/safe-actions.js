const ALLOWED_SELECTOR = /^(#[A-Za-z][\w:-]*|\.[A-Za-z][\w:-]*|\[data-[\w-]+(?:=["'][^"']+["'])?\])$/;

/** @typedef {{ ok: boolean, id: string, label?: string, reason?: string, error?: unknown }} ActionResult */

/**
 * Create a registry that only runs explicitly registered actions. Unknown ids
 * and thrown handlers resolve to a structured `{ ok: false }` result rather
 * than rejecting, so the caller can reliably report outcomes.
 *
 * @param {Record<string, Function>} [initialActions] Map of id -> run handler.
 * @returns {{ register: Function, execute: (action: string|{id:string}, context?: object) => Promise<ActionResult>,
 *   list: () => Array<{ id: string, label: string }>, has: (id: string) => boolean }}
 */
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
    try {
      await entry.run({ ...context, action });
      return { ok: true, id, label: entry.label };
    } catch (error) {
      return { ok: false, id, label: entry.label, reason: 'action_failed', error };
    }
  }

  function list() {
    return Array.from(actions, ([id, action]) => ({ id, label: action.label }));
  }

  return api;
}

/**
 * Build a safe action that targets a single element via an allow-listed CSS
 * selector (id, class, or `[data-*]` only). Throws on unsafe selectors.
 *
 * @param {object} options
 * @param {string} options.id Action id.
 * @param {string} [options.label] Display label.
 * @param {string} options.selector Allow-listed selector.
 * @param {'highlight'|'scroll'|'focus'} [options.behavior] DOM behavior.
 * @returns {{ id: string, label?: string, run: (ctx: { document?: Document }) => void }}
 */
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
