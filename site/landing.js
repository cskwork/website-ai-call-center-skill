import { CALL_SCENARIOS, getScenarioReply } from './scenarios.js';

const sdk = window.WebsiteAICallCenter;

const STT_MODEL_ID = 'onnx-community/distil-small.en';
const STT_DTYPE = 'q4';
const TTS_VOICE = 'en_US-hfc_female-medium';
const TTS_DTYPE = 'fp32';
const PIPER_WASM_PATHS = {
  onnxWasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
  piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
};

let latestIssue = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!sdk) throw new Error('WebsiteAICallCenter bundle did not load.');
  initTheme();
  initWaveform();
  initTabs();
  initChecks();
  initActiveNav();
  initCopyButton();
  initCallCenter();
});

function initCallCenter() {
  const actionRegistry = createLandingActions();
  const center = sdk.createWebsiteCallCenter({
    title: 'Static AI support',
    actionRegistry,
    engine: createLandingEngine(),
    ...createWasmSpeechAdapters(),
  });
  renderPhraseButtons();
  renderScenarioCatalog();
  wireDemoButtons(center);
  wireCenterEvents(center);
}

function createLandingActions() {
  return sdk.createSafeActionRegistry()
    .register({ id: 'show-audio', label: 'Show audio setup', run: () => showTarget('#target-audio') })
    .register({ id: 'show-account', label: 'Show account path', run: () => showTarget('#target-account') })
    .register({ id: 'run-checks', label: 'Run browser checks', run: runVisibleChecks })
    .register({ id: 'draft-ticket', label: 'Draft support ticket', run: draftTicket });
}

function createLandingEngine() {
  return {
    async startSession() {
      return { sessionId: `landing-${Date.now().toString(36)}` };
    },
    async sendUserText(text) {
      latestIssue = text;
      return getScenarioReply(text);
    },
    async endSession() {
      updateStatus('Ended');
    },
  };
}

function createWasmSpeechAdapters() {
  const { sttWorkerUrl, ttsWorkerUrl } = sdk.createWorkerAssetUrls(new URL('./dist/', location.href));
  const wasmTts = sdk.createPiperTtsAdapter({
    workerUrl: ttsWorkerUrl,
    fallback: sdk.createNoopTtsAdapter(),
    modelId: TTS_VOICE,
    voice: TTS_VOICE,
    dtype: TTS_DTYPE,
    useOpfsCache: true,
    wasmPaths: PIPER_WASM_PATHS,
  });
  return {
    stt: sdk.createWasmSttAdapter({
      workerUrl: sttWorkerUrl,
      modelId: STT_MODEL_ID,
      dtype: STT_DTYPE,
      useOpfsCache: true,
    }),
    tts: createPreparedOnlyTtsAdapter(wasmTts),
  };
}

function createPreparedOnlyTtsAdapter(wasmTts) {
  let prepared = false;
  return {
    async prepare(report = () => {}) {
      await wasmTts.prepare(report);
      prepared = true;
    },
    async speak(text) {
      if (!prepared) {
        updateNote('Text reply shown. Press Prepare first to enable Piper WASM TTS.');
        return;
      }
      await wasmTts.speak(text);
    },
    stop() {
      wasmTts.stop?.();
      prepared = false;
    },
  };
}

function wireDemoButtons(center) {
  document.querySelector('#launch-demo')?.addEventListener('click', openOverlay);
  document.querySelectorAll('[data-phrase]').forEach((button) => {
    button.addEventListener('click', () => pastePhrase(button.dataset.phrase || ''));
  });
  center.on('state', ({ state }) => updateStatus(state));
}

function wireCenterEvents(center) {
  center.on('progress', (event) => {
    const progress = Math.round(Number(event.progress || 0));
    const area = event.area || 'model';
    document.querySelector('#model-progress').textContent = `${area} ${event.phase || 'progress'} ${progress}%`;
  });
  center.on('error', (event) => updateNote(`Error in ${event.area}: ${event.message}`));
  center.on('action', (event) => updateNote(`Action ${event.id}: ${event.status}`));
}

function renderPhraseButtons() {
  const grid = document.querySelector('#phrase-grid');
  if (!grid) return;
  grid.replaceChildren(...CALL_SCENARIOS.map(createPhraseButton));
}

function createPhraseButton(scenario) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.phrase = scenario.phrase;
  button.textContent = scenario.buttonLabel;
  return button;
}

function renderScenarioCatalog() {
  const catalog = document.querySelector('#scenario-catalog');
  if (!catalog) return;
  catalog.replaceChildren(...CALL_SCENARIOS.map(createScenarioCard));
}

function createScenarioCard(scenario) {
  const card = document.createElement('article');
  card.className = 'scenario-card';
  card.dataset.scenarioId = scenario.id;
  card.append(createScenarioHeader(scenario), paragraph(scenario.summary), createScenarioMeta(scenario));
  return card;
}

function createScenarioHeader(scenario) {
  const header = document.createElement('header');
  const label = document.createElement('span');
  const title = document.createElement('h3');
  label.textContent = scenario.id;
  title.textContent = scenario.title;
  header.append(label, title);
  return header;
}

function createScenarioMeta(scenario) {
  const meta = document.createElement('div');
  meta.className = 'scenario-meta';
  meta.append(metaBlock('Scenario intent', scenario.scenario_intent));
  meta.append(metaBlock('Workflow issue type', scenario.workflow?.issue_type || 'none'));
  meta.append(metaBlock('Sample phrase', scenario.phrase));
  meta.append(chipBlock('Match terms', scenario.terms));
  meta.append(chipBlock('Safe actions', scenario.actions.map((action) => action.label)));
  return meta;
}

function metaBlock(label, value) {
  const block = document.createElement('section');
  block.append(smallLabel(label), paragraph(value));
  return block;
}

function chipBlock(label, values) {
  const block = document.createElement('section');
  const chips = document.createElement('div');
  chips.className = 'scenario-chips';
  chips.append(...values.map(createChip));
  block.append(smallLabel(label), chips);
  return block;
}

function createChip(value) {
  const chip = document.createElement('span');
  chip.textContent = value;
  return chip;
}

function smallLabel(text) {
  const label = document.createElement('strong');
  label.textContent = text;
  return label;
}

function paragraph(text) {
  const node = document.createElement('p');
  node.textContent = text;
  return node;
}

function pastePhrase(text) {
  openOverlay();
  const input = document.querySelector('.waicc-input');
  if (input instanceof HTMLTextAreaElement) input.value = text;
}

function openOverlay() {
  document.querySelector('.waicc-fab')?.click();
}

function showTarget(selector) {
  const target = document.querySelector(selector);
  if (!(target instanceof HTMLElement)) return;
  document.querySelectorAll('.waicc-highlight').forEach((node) => node.classList.remove('waicc-highlight'));
  target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  target.classList.add('waicc-highlight');
  target.focus({ preventScroll: true });
}

async function runVisibleChecks() {
  await Promise.all(Array.from(document.querySelectorAll('[data-check]'), (button) => runCheck(button)));
  showTarget('#target-diagnostics');
}

function draftTicket() {
  const draft = document.querySelector('#ticket-draft');
  if (!(draft instanceof HTMLTextAreaElement)) return;
  draft.value = `Issue: ${latestIssue || 'No issue captured yet'}\nPage: ${location.pathname}\nSpeech: WASM STT ${STT_MODEL_ID}, Piper ${TTS_VOICE}`;
  showTarget('#target-ticket');
}

function initChecks() {
  document.querySelectorAll('[data-check]').forEach((button) => {
    button.addEventListener('click', () => runCheck(button));
  });
}

async function runCheck(button) {
  const row = button.closest('[data-check-row]');
  const output = row?.querySelector('output');
  if (!row || !(output instanceof HTMLOutputElement)) return;
  output.value = 'Checking...';
  const result = await checks[button.dataset.check]?.();
  row.dataset.checkState = result?.state || 'fail';
  output.value = result?.message || 'Check failed.';
  updateDiagnosticsSummary();
}

const checks = {
  secure: async () => isSecureContext
    ? pass('Secure context is active.')
    : fail('This page is not secure. Use HTTPS or localhost.'),
  wasm: async () => canCompileWasm()
    ? pass('WebAssembly module validation passed.')
    : fail('WebAssembly is not available in this browser.'),
  worker: async () => await canRunWorker()
    ? pass('Dedicated worker executed a probe.')
    : fail('Dedicated workers are blocked or unavailable.'),
  storage: async () => await canUseStorage()
    ? pass('IndexedDB opened and cleaned up.')
    : warn('IndexedDB is unavailable; model caching may be limited.'),
  microphone: async () => await microphoneState(),
};

function pass(message) {
  return { state: 'pass', message };
}

function warn(message) {
  return { state: 'warn', message };
}

function fail(message) {
  return { state: 'fail', message };
}

function canCompileWasm() {
  const bytes = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
  return typeof WebAssembly === 'object' && WebAssembly.validate(bytes);
}

async function canRunWorker() {
  if (!('Worker' in window) || !('Blob' in window) || !('URL' in window)) return false;
  const blob = new Blob(['postMessage("ok")'], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return await workerProbe(url);
}

function workerProbe(url) {
  return new Promise((resolve) => {
    const worker = new Worker(url);
    const finish = (ok) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    worker.onmessage = (event) => finish(event.data === 'ok');
    worker.onerror = () => finish(false);
    setTimeout(() => finish(false), 1200);
  });
}

async function canUseStorage() {
  if (!('indexedDB' in window)) return false;
  return await new Promise((resolve) => {
    const name = `waicc-check-${Date.now()}`;
    const request = indexedDB.open(name, 1);
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      request.result.close();
      indexedDB.deleteDatabase(name);
      resolve(true);
    };
  });
}

async function microphoneState() {
  if (!navigator.mediaDevices?.getUserMedia) return fail('getUserMedia is not available.');
  try {
    const permission = await navigator.permissions?.query?.({ name: 'microphone' });
    if (!permission) return warn('Microphone API exists; permission state is unavailable until click.');
    return permission.state === 'denied'
      ? fail('Microphone permission is denied for this site.')
      : pass(`Microphone permission state: ${permission.state}.`);
  } catch {
    return warn('Microphone API exists; permission state requires a user gesture.');
  }
}

function updateDiagnosticsSummary() {
  const rows = Array.from(document.querySelectorAll('[data-check-state]'));
  const passCount = rows.filter((row) => row.dataset.checkState === 'pass').length;
  const warnCount = rows.filter((row) => row.dataset.checkState === 'warn').length;
  const failCount = rows.filter((row) => row.dataset.checkState === 'fail').length;
  document.querySelector('#diagnostic-copy').textContent =
    `${passCount} passing, ${warnCount} warning, ${failCount} failing checks.`;
}

function initTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-tab]'));
  buttons.forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)));
  const hash = location.hash.replace('#', '');
  if (['html', 'init', 'actions'].includes(hash)) activateTab(hash);
}

function activateTab(name) {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.tab === name));
  });
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
  if (['html', 'init', 'actions'].includes(name)) history.replaceState(null, '', `#${name}`);
}

function initCopyButton() {
  document.querySelector('[data-copy-active]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    await navigator.clipboard?.writeText?.(panel?.textContent?.trim() || '');
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy active snippet'; }, 1400);
  });
}

function initTheme() {
  const button = document.querySelector('#theme-toggle');
  button?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    button.setAttribute('aria-pressed', String(next === 'light'));
    button.textContent = next === 'light' ? 'Dark mode' : 'Light mode';
    drawStaticWave();
  });
}

function initActiveNav() {
  const links = new Map(Array.from(document.querySelectorAll('.site-nav a'), (link) => [link.hash, link]));
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => setActiveLink(links, `#${entry.target.id}`));
  }, { rootMargin: '-35% 0px -55% 0px' });
  document.querySelectorAll('[data-nav-section]').forEach((section) => observer.observe(section));
}

function setActiveLink(links, hash) {
  links.forEach((link, key) => link.setAttribute('aria-current', String(key === hash)));
}

function initWaveform() {
  const canvas = document.querySelector('#wave-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext('2d');
  if (!context || reducedMotion()) return drawWave(context, canvas, 0);
  const start = performance.now();
  const tick = (time) => {
    drawWave(context, canvas, (time - start) / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function drawStaticWave() {
  const canvas = document.querySelector('#wave-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext('2d');
  if (context) drawWave(context, canvas, 0);
}

function drawWave(context, canvas, seconds) {
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  drawGrid(context, width, height);
  drawSignal(context, width, height, seconds);
}

function drawGrid(context, width, height) {
  const light = document.documentElement.dataset.theme === 'light';
  context.strokeStyle = light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 42) line(context, x, 0, x, height);
  for (let y = 0; y <= height; y += 42) line(context, 0, y, width, y);
}

function drawSignal(context, width, height, seconds) {
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#22d3ee');
  gradient.addColorStop(1, '#6366f1');
  context.beginPath();
  context.strokeStyle = gradient;
  context.lineWidth = 4;
  for (let x = 0; x <= width; x += 3) {
    const y = height / 2 + Math.sin(x / 28 + seconds * 2.8) * 32 + Math.sin(x / 11 + seconds) * 10;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

function line(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function updateStatus(state) {
  document.querySelector('#hero-status').textContent = state;
}

function updateNote(message) {
  document.querySelector('#demo-note').textContent = message;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
