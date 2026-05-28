/** @typedef {import('../i18n/ui-strings.js').UiStrings} UiStrings */
/** @typedef {{ id: string, label?: string }} ActionDescriptor */
/** @typedef {{ state: string, prepared: boolean }} ControlContext */

/**
 * Pure, unit-testable derivation of footer-control visibility from the current
 * machine state and the `prepared` flag. The voice button is a single morphing
 * control (prepare / start / stop). No DOM access; safe to test in isolation.
 *
 * @param {string} state Current call-state-machine state.
 * @param {boolean} prepared Whether local voice models are loaded.
 * @param {UiStrings} strings Localized string set.
 * @returns {{ voice: { show: boolean, mode: 'prepare'|'start'|'stop', label: string, icon: string },
 *   send: { show: boolean }, stopSpeaking: { show: boolean }, end: { show: boolean } }}
 */
export function controlsForState(state, prepared, strings) {
  const voice = voiceControl(state, prepared, strings);
  const sessionActive = prepared === true || ['preparing', 'listening', 'thinking', 'speaking'].includes(state);
  return {
    voice,
    send: { show: true },
    stopSpeaking: { show: state === 'speaking' },
    end: { show: sessionActive },
  };
}

/**
 * @param {string} state
 * @param {boolean} prepared
 * @param {UiStrings} strings
 * @returns {{ show: boolean, mode: 'prepare'|'start'|'stop', label: string, icon: string }}
 */
function voiceControl(state, prepared, strings) {
  if (!prepared) return { show: true, mode: 'prepare', label: strings.prepare, icon: 'mic-off' };
  if (state === 'listening') return { show: true, mode: 'stop', label: strings.voiceStop, icon: 'stop' };
  return { show: true, mode: 'start', label: strings.voiceStart, icon: 'mic' };
}

const STATUS_STATES = Object.freeze(['idle', 'preparing', 'listening', 'thinking', 'speaking', 'ended', 'error']);

/** Inline SVG icon markup (stroke=currentColor, 18px, aria-hidden). */
const ICONS = Object.freeze({
  mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  'mic-off': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="2" y1="2" x2="22" y2="22"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-1m14 0v1a6.94 6.94 0 0 1-.65 2.92"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  stop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  hangup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 0-2.7-.18 12.84 12.84 0 0 0-.7 2.81A2 2 0 0 0 3.92 9.6"/><line x1="23" y1="1" x2="1" y2="23"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
});

const FOCUSABLE = 'button:not([hidden]):not([disabled]),textarea,[href],[tabindex]:not([tabindex="-1"])';

/**
 * Create the support overlay (FAB + dialog) and mount it. Methods close over
 * `root`/`els` (no `this`-binding) so they remain valid when detached.
 *
 * @param {object} [options]
 * @param {Element} [options.mount] Host element to append the overlay to.
 * @param {UiStrings} options.strings Localized string set (required for i18n).
 * @param {string} [options.title] Title override; wins over `strings.title`.
 * @param {(type: string, payload: object) => void} [options.onEvent] Command handler.
 * @param {(actionId: string) => void} [options.onAction] Safe-action handler.
 * @returns {{ root: Element, setOpen: (open: boolean) => void,
 *   setState: (state: string) => void, setControls: (ctx: ControlContext) => void,
 *   setProgress: (event: object) => void, addMessage: (role: string, text: string) => void,
 *   setActions: (actions: ActionDescriptor[]) => void, setTranscript: (text: string) => void,
 *   setStrings: (strings: UiStrings, title?: string) => void, destroy: () => void }}
 */
export function createOverlay({ mount = document.body, strings, title, onEvent = () => {}, onAction = () => {} } = {}) {
  if (!strings) throw new TypeError('createOverlay requires a strings dictionary.');
  let current = strings;
  let titleOverride = title;
  let last = /** @type {ControlContext} */ ({ state: 'idle', prepared: false });

  const root = document.createElement('div');
  root.className = 'waicc-root';
  root.innerHTML = markup(resolveTitle(current, titleOverride), current);
  mount.append(root);

  const els = collect(root);
  applyStaticStrings(els, current, resolveTitle(current, titleOverride));
  wireEvents(els, onEvent, onAction, setOpen);
  setControls(last);
  setOpen(false);

  /** @param {boolean} open */
  function setOpen(open) {
    els.panel.hidden = !open;
    els.fab.hidden = open;
    if (open) (firstFocusable(els.panel) ?? els.input)?.focus();
    else els.fab.focus();
  }

  /** @param {string} state Backward-compatible status update by state alone. */
  function setState(state) {
    setControls({ state, prepared: last.prepared });
  }

  /** @param {ControlContext} ctx */
  function setControls(ctx) {
    last = { state: ctx.state, prepared: ctx.prepared === true };
    renderStatus(els, current, last.state);
    renderControls(els, controlsForState(last.state, last.prepared, current));
    root.dataset.state = last.state;
  }

  /** @param {object} event Progress event with optional `progress`/`area`/`phase`. */
  function setProgress(event) {
    const value = Math.max(0, Math.min(100, Number(event?.progress || 0)));
    els.progressBar.style.width = `${value}%`;
    els.progressBar.title = `${event?.area || 'model'} ${event?.phase || ''} ${value}%`;
    const visible = last.state === 'preparing' || (value > 0 && value < 100);
    els.progress.hidden = !visible;
  }

  /** @param {string} role @param {string} text */
  function addMessage(role, text) {
    const item = document.createElement('p');
    item.className = `waicc-message waicc-${role}`;
    item.textContent = String(text ?? '');
    els.messages.append(item);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  /** @param {ActionDescriptor[]} actions */
  function setActions(actions) {
    const list = Array.isArray(actions) ? actions : [];
    els.actions.replaceChildren(...list.map(actionButton));
  }

  /** @param {string} text */
  function setTranscript(text) {
    els.input.value = String(text ?? '');
  }

  /** @param {UiStrings} next @param {string} [nextTitle] */
  function setStrings(next, nextTitle) {
    current = next;
    if (nextTitle !== undefined) titleOverride = nextTitle;
    applyStaticStrings(els, current, resolveTitle(current, titleOverride));
    setControls(last);
  }

  function destroy() {
    root.remove();
  }

  return { root, setOpen, setState, setControls, setProgress, addMessage, setActions, setTranscript, setStrings, destroy };
}

/**
 * @param {UiStrings} strings
 * @param {string|undefined} override
 * @returns {string}
 */
function resolveTitle(strings, override) {
  return typeof override === 'string' && override.length > 0 ? override : strings.title;
}

/**
 * @param {string} title
 * @param {UiStrings} strings
 * @returns {string}
 */
function markup(title, strings) {
  return `
    <button class="waicc-fab" type="button" aria-haspopup="dialog">${escapeHtml(strings.fab)}</button>
    <section class="waicc-panel" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}" hidden>
      <header class="waicc-header"><strong class="waicc-title">${escapeHtml(title)}</strong><button class="waicc-close" type="button">${ICONS.close}</button></header>
      <div class="waicc-status" role="status" aria-live="polite"><span class="waicc-dot" aria-hidden="true"></span><span class="waicc-status-text"></span></div>
      <div class="waicc-progress" hidden><span></span></div>
      <div class="waicc-messages" aria-live="polite"></div>
      <div class="waicc-actions"></div>
      <label class="waicc-label"><span class="waicc-label-text"></span><textarea class="waicc-input" rows="3"></textarea></label>
      <footer class="waicc-controls">
        <button class="waicc-icon-btn" data-waicc="voice" type="button"></button>
        <button class="waicc-icon-btn" data-waicc="stop" type="button"></button>
        <button class="waicc-send" data-waicc="send" type="button"><span class="waicc-icon"></span><span class="waicc-send-text"></span></button>
        <button class="waicc-icon-btn" data-waicc="end" type="button"></button>
      </footer>
    </section>`;
}

/**
 * @param {Element} root
 * @returns {Record<string, HTMLElement>}
 */
function collect(root) {
  /** @param {string} selector */
  const q = (selector) => /** @type {HTMLElement} */ (root.querySelector(selector));
  return {
    fab: q('.waicc-fab'),
    panel: q('.waicc-panel'),
    title: q('.waicc-title'),
    close: q('.waicc-close'),
    status: q('.waicc-status'),
    statusText: q('.waicc-status-text'),
    progress: q('.waicc-progress'),
    progressBar: q('.waicc-progress span'),
    messages: q('.waicc-messages'),
    actions: q('.waicc-actions'),
    label: q('.waicc-label-text'),
    input: q('.waicc-input'),
    voice: q('[data-waicc="voice"]'),
    stop: q('[data-waicc="stop"]'),
    send: q('[data-waicc="send"]'),
    sendText: q('.waicc-send-text'),
    sendIcon: q('.waicc-send .waicc-icon'),
    end: q('[data-waicc="end"]'),
  };
}

/**
 * Swap all static (non-state) localized strings via textContent / aria-label.
 *
 * @param {Record<string, HTMLElement>} els
 * @param {UiStrings} strings
 * @param {string} title
 */
function applyStaticStrings(els, strings, title) {
  els.fab.textContent = strings.fab;
  els.title.textContent = title;
  els.panel.setAttribute('aria-label', title);
  els.close.setAttribute('aria-label', strings.close);
  els.label.textContent = strings.inputLabel;
  els.input.setAttribute('placeholder', strings.inputPlaceholder);
  els.input.setAttribute('aria-label', strings.inputLabel);
  els.input.setAttribute('title', strings.prepareHint);
  els.sendText.textContent = strings.send;
  els.send.setAttribute('aria-label', strings.send);
  els.sendIcon.innerHTML = ICONS.send;
  els.stop.innerHTML = ICONS.stop;
  els.stop.setAttribute('aria-label', strings.stopSpeaking);
  els.end.innerHTML = ICONS.hangup;
  els.end.setAttribute('aria-label', strings.end);
}

/**
 * @param {Record<string, HTMLElement>} els
 * @param {UiStrings} strings
 * @param {string} state
 */
function renderStatus(els, strings, state) {
  const key = STATUS_STATES.includes(state) ? state : 'idle';
  els.statusText.textContent = strings.status[/** @type {keyof UiStrings['status']} */ (key)];
  els.status.dataset.state = key;
}

/**
 * Apply control visibility + the morphing voice button to the footer DOM.
 * When a control that currently holds focus is about to be hidden, focus is
 * relocated to a stable visible anchor first so it never falls to document.body
 * (which would break the dialog focus trap — WCAG 2.4.3).
 *
 * @param {Record<string, HTMLElement>} els
 * @param {ReturnType<typeof controlsForState>} controls
 */
function renderControls(els, controls) {
  setHidden(els, els.voice, !controls.voice.show);
  els.voice.innerHTML = ICONS[/** @type {keyof typeof ICONS} */ (controls.voice.icon)] || '';
  els.voice.setAttribute('aria-label', controls.voice.label);
  els.voice.dataset.mode = controls.voice.mode;
  setHidden(els, els.stop, !controls.stopSpeaking.show);
  setHidden(els, els.send, !controls.send.show);
  setHidden(els, els.end, !controls.end.show);
}

/**
 * Hide/show a footer control, relocating focus off it before hiding if it is the
 * active element, so focus stays inside the open dialog.
 *
 * @param {Record<string, HTMLElement>} els
 * @param {HTMLElement} node
 * @param {boolean} hidden
 */
function setHidden(els, node, hidden) {
  if (hidden && !node.hidden && node.ownerDocument.activeElement === node) {
    relocateFocus(els, node);
  }
  node.hidden = hidden;
}

/**
 * Move focus from a control being hidden to a stable visible anchor inside the
 * panel: the textarea, then the visible voice button, then the first focusable.
 *
 * @param {Record<string, HTMLElement>} els
 * @param {HTMLElement} hiding The node about to be hidden.
 */
function relocateFocus(els, hiding) {
  const anchors = [els.input, els.voice].filter((node) => node !== hiding && !node.hidden);
  const target = anchors[0] ?? firstFocusable(els.panel);
  target?.focus();
}

/**
 * @param {Record<string, HTMLElement>} els
 * @param {(type: string, payload: object) => void} onEvent
 * @param {(actionId: string) => void} onAction
 * @param {(open: boolean) => void} setOpen
 */
function wireEvents(els, onEvent, onAction, setOpen) {
  els.fab.addEventListener('click', () => setOpen(true));
  els.close.addEventListener('click', () => setOpen(false));
  els.panel.addEventListener('keydown', (event) => handleKeydown(/** @type {KeyboardEvent} */ (event), els, setOpen));
  els.panel.addEventListener('click', (event) => handleClick(/** @type {MouseEvent} */ (event), els, onEvent, onAction));
}

/**
 * @param {KeyboardEvent} event
 * @param {Record<string, HTMLElement>} els
 * @param {(open: boolean) => void} setOpen
 */
function handleKeydown(event, els, setOpen) {
  if (event.key === 'Escape') { setOpen(false); return; }
  if (event.key === 'Tab') trapFocus(event, els.panel);
}

/**
 * Keep Tab/Shift+Tab focus cycling inside the dialog.
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement} panel
 */
function trapFocus(event, panel) {
  const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((node) => !(/** @type {HTMLElement} */ (node).hidden));
  if (nodes.length === 0) return;
  const first = /** @type {HTMLElement} */ (nodes[0]);
  const lastNode = /** @type {HTMLElement} */ (nodes[nodes.length - 1]);
  const active = panel.ownerDocument.activeElement;
  if (event.shiftKey && active === first) { event.preventDefault(); lastNode.focus(); }
  else if (!event.shiftKey && active === lastNode) { event.preventDefault(); first.focus(); }
}

/**
 * @param {HTMLElement} panel
 * @returns {HTMLElement|null}
 */
function firstFocusable(panel) {
  const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((node) => !(/** @type {HTMLElement} */ (node).hidden));
  return /** @type {HTMLElement|null} */ (nodes[0] ?? null);
}

/**
 * @param {MouseEvent} event
 * @param {Record<string, HTMLElement>} els
 * @param {(type: string, payload: object) => void} onEvent
 * @param {(actionId: string) => void} onAction
 */
function handleClick(event, els, onEvent, onAction) {
  const button = /** @type {HTMLElement|null} */ (/** @type {Element} */ (event.target).closest('button'));
  if (!button) return;
  const command = button.dataset.waicc;
  if (command === 'send') onEvent('sendText', { text: els.input.value });
  else if (command) onEvent(command, {});
  if (button.dataset.actionId) onAction(button.dataset.actionId);
}

/**
 * @param {ActionDescriptor} action
 * @returns {HTMLButtonElement}
 */
function actionButton(action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.actionId = action.id;
  button.textContent = action.label || action.id;
  return button;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
