export function createOverlay({ mount = document.body, title = 'AI support call', onEvent = () => {}, onAction = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'waicc-root';
  root.innerHTML = markup(title);
  mount.append(root);

  const els = collect(root);
  const api = { root, setOpen, setState, setProgress, addMessage, setActions, setTranscript, destroy: () => root.remove() };
  wireEvents(els, onEvent, onAction, api);
  api.setOpen(false);
  return api;
}

function markup(title) {
  return `
    <button class="waicc-fab" type="button" aria-haspopup="dialog">Support</button>
    <section class="waicc-panel" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}" hidden>
      <header class="waicc-header"><strong>${escapeHtml(title)}</strong><button class="waicc-close" type="button" aria-label="Close">×</button></header>
      <div class="waicc-status" role="status">Idle</div>
      <div class="waicc-progress" aria-label="Model progress"><span></span></div>
      <div class="waicc-messages" aria-live="polite"></div>
      <div class="waicc-actions"></div>
      <label class="waicc-label">Message<textarea class="waicc-input" rows="3" placeholder="Describe the problem"></textarea></label>
      <footer class="waicc-controls">
        <button data-waicc="prepare" type="button">Prepare</button>
        <button data-waicc="voice" type="button">Voice</button>
        <button data-waicc="stop" type="button">Stop</button>
        <button data-waicc="send" type="button">Send</button>
        <button data-waicc="end" type="button">End</button>
      </footer>
    </section>`;
}

function collect(root) {
  return {
    fab: root.querySelector('.waicc-fab'),
    panel: root.querySelector('.waicc-panel'),
    close: root.querySelector('.waicc-close'),
    status: root.querySelector('.waicc-status'),
    progress: root.querySelector('.waicc-progress span'),
    messages: root.querySelector('.waicc-messages'),
    actions: root.querySelector('.waicc-actions'),
    input: root.querySelector('.waicc-input'),
  };
}

function wireEvents(els, onEvent, onAction, api) {
  els.fab.addEventListener('click', () => api.setOpen(true));
  els.close.addEventListener('click', () => api.setOpen(false));
  els.panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') api.setOpen(false); });
  els.panel.addEventListener('click', (event) => handleClick(event, els, onEvent, onAction));
}

function handleClick(event, els, onEvent, onAction) {
  const button = event.target.closest('button');
  if (!button) return;
  const command = button.dataset.waicc;
  if (command === 'send') onEvent('sendText', { text: els.input.value });
  else if (command) onEvent(command, {});
  if (button.dataset.actionId) onAction(button.dataset.actionId);
}

function setOpen(open) {
  const panel = this?.root ? this.root.querySelector('.waicc-panel') : null;
  const fab = this?.root ? this.root.querySelector('.waicc-fab') : null;
  if (!panel || !fab) return;
  panel.hidden = !open;
  fab.hidden = open;
  if (open) panel.querySelector('textarea,button')?.focus();
  else fab.focus();
}

function setState(state) {
  const status = this.root.querySelector('.waicc-status');
  status.textContent = `State: ${state}`;
  this.root.dataset.state = state;
}

function setProgress(event) {
  const bar = this.root.querySelector('.waicc-progress span');
  const value = Math.max(0, Math.min(100, Number(event.progress || 0)));
  bar.style.width = `${value}%`;
  bar.title = `${event.area || 'model'} ${event.phase || ''} ${value}%`;
}

function addMessage(role, text) {
  const item = document.createElement('p');
  item.className = `waicc-message waicc-${role}`;
  item.textContent = text;
  this.root.querySelector('.waicc-messages').append(item);
}

function setActions(actions) {
  const host = this.root.querySelector('.waicc-actions');
  host.replaceChildren(...actions.map((action) => actionButton(action)));
}

function setTranscript(text) {
  this.root.querySelector('.waicc-input').value = text;
}

function actionButton(action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.actionId = action.id;
  button.textContent = action.label || action.id;
  return button;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
