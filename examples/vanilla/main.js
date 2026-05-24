/** @typedef {typeof import('../../src/api.js')} WebsiteAICallCenterSdk */
/** @typedef {{ search: string, diagnostics: string }} PageContext */
/** @typedef {{ text: string, actions: Array<{ id: string, label: string }> }} AssistantReply */
/** @typedef {{ text: string, context: PageContext, sessionId: string }} ScenarioInput */
/** @typedef {{ id?: string, terms?: string[], reply: (input: ScenarioInput) => AssistantReply }} Scenario */
/** @typedef {{ prepare: (report?: (event: unknown) => void) => Promise<void>, speak: (text: string) => Promise<void>, stop?: () => void }} TtsAdapter */

const sdkHost = /** @type {any} */ (window);
const sdk = /** @type {WebsiteAICallCenterSdk} */ (sdkHost['WebsiteAICallCenter']);

const STT_MODEL_ID = 'onnx-community/distil-small.en';
const STT_DTYPE = 'q4';
const TTS_VOICE = 'en_US-hfc_female-medium';
const TTS_DTYPE = 'fp32';
const PIPER_WASM_PATHS = {
  onnxWasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
  piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
};

let latestIssueText = '';

const actionRegistry = createSupportActions();
const center = sdk.createWebsiteCallCenter({
  title: 'AI technical support',
  actionRegistry,
  engine: createSupportScenarioEngine({ getPageContext }),
  ...createWasmSpeechAdapters(),
});

wireDemoControls(center);
wireCallCenterEvents(center);
announceWasmSpeechMode();

function createSupportActions() {
  const registry = sdk.createSafeActionRegistry();
  return registry
    .register({ id: 'show-overview', label: 'Show portal overview', run: () => showPanel('#overview') })
    .register({ id: 'show-account', label: 'Show account settings', run: () => showPanel('#account') })
    .register({ id: 'show-network', label: 'Show network status', run: () => showPanel('#network') })
    .register({ id: 'show-billing', label: 'Show billing', run: () => showPanel('#billing') })
    .register({ id: 'search-account', label: 'Search account help', run: () => fillSearch('account settings password profile') })
    .register({ id: 'search-billing', label: 'Search billing help', run: () => fillSearch('invoice payment refund') })
    .register({ id: 'run-diagnostics', label: 'Run diagnostics', run: runDiagnostics })
    .register({ id: 'draft-ticket', label: 'Draft support ticket', run: draftTicket });
}

/** @param {{ getPageContext: () => PageContext }} options */
function createSupportScenarioEngine({ getPageContext: readContext }) {
  let sessionId = '';
  return {
    async startSession() {
      sessionId = globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}`;
      addLog(`Started support session ${sessionId}`);
      return { sessionId };
    },
    async sendUserText(text) {
      latestIssueText = text;
      const scenario = selectScenario(text);
      const context = readContext();
      return scenario.reply({ text, context, sessionId });
    },
    async endSession() {
      addLog('Ended support session');
      sessionId = '';
    },
  };
}

function createWasmSpeechAdapters() {
  const workerBase = new URL('../../dist/', location.href);
  const { sttWorkerUrl, ttsWorkerUrl } = sdk.createWorkerAssetUrls(workerBase);
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
        addLog('WASM TTS is not loaded yet. Click Prepare to enable spoken replies.');
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

/** @type {Scenario[]} */
const SCENARIOS = [
  {
    id: 'account',
    terms: ['account', 'settings', 'password', 'profile', 'sign in'],
    reply: () => ({
      text: 'I found the account path. I can show Account settings and fill the help search with account keywords.',
      actions: [{ id: 'show-account', label: 'Show account settings' }, { id: 'search-account', label: 'Search account help' }],
    }),
  },
  {
    id: 'network',
    terms: ['network', 'internet', 'offline', 'loading', 'diagnostic', 'connection'],
    reply: () => ({
      text: 'Let us check the connection state. I can show Network status and run browser-local diagnostics.',
      actions: [{ id: 'show-network', label: 'Show network status' }, { id: 'run-diagnostics', label: 'Run diagnostics' }],
    }),
  },
  {
    id: 'billing',
    terms: ['billing', 'invoice', 'payment', 'refund', 'card'],
    reply: () => ({
      text: 'Billing help is ready. I can show the Billing section and search invoice and payment topics.',
      actions: [{ id: 'show-billing', label: 'Show billing' }, { id: 'search-billing', label: 'Search billing help' }],
    }),
  },
  {
    id: 'ticket',
    terms: ['ticket', 'agent', 'technical support', 'case', 'escalate'],
    reply: () => ({
      text: 'I can draft a support ticket with your issue summary so a human support flow has context.',
      actions: [{ id: 'draft-ticket', label: 'Draft support ticket' }],
    }),
  },
];

/**
 * @param {string} text
 * @returns {Scenario}
 */
function selectScenario(text) {
  const normalized = text.toLowerCase();
  const ranked = SCENARIOS
    .map((scenario) => ({ scenario, score: scenario.terms.filter((term) => normalized.includes(term)).length }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0].scenario : defaultScenario();
}

/** @returns {Scenario} */
function defaultScenario() {
  return /** @type {Scenario} */ ({
    reply: (input) => ({
      text: `I can guide this page. Current search is "${input.context.search || 'empty'}". Start with overview or diagnostics.`,
      actions: [{ id: 'show-overview', label: 'Show overview' }, { id: 'run-diagnostics', label: 'Run diagnostics' }],
    }),
  });
}

/** @param {string} selector */
function showPanel(selector) {
  const target = document.querySelector(selector);
  if (!(target instanceof HTMLElement)) return;
  document.querySelectorAll('.waicc-highlight').forEach((node) => node.classList.remove('waicc-highlight'));
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('waicc-highlight');
  target.focus?.({ preventScroll: true });
  addLog(`Highlighted ${target.querySelector('h2')?.textContent || selector}`);
}

/** @param {string} query */
function fillSearch(query) {
  const input = inputElement('#help-search');
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  showPanel('#overview');
  addLog(`Filled help search with "${query}"`);
}

function runDiagnostics() {
  const online = navigator.onLine ? 'online' : 'offline';
  const result = `Browser reports ${online}. Last checked ${new Date().toLocaleTimeString()}.`;
  textElement('#diagnostic-result').textContent = result;
  textElement('#network-copy').textContent = result;
  showPanel('#diagnostics');
  addLog('Ran local diagnostics');
}

function draftTicket() {
  const issue = latestIssueText || selectElement('#demo-transcript').value;
  const text = `Issue: ${issue}\nPage: ${location.pathname}\nSearch: ${inputElement('#help-search').value || 'none'}`;
  textareaElement('#ticket-summary').value = text;
  showPanel('#ticket');
  addLog('Drafted support ticket');
}

function getPageContext() {
  return {
    search: inputElement('#help-search').value.trim(),
    diagnostics: textElement('#diagnostic-result').textContent.trim(),
  };
}

/** @param {{ on: (event: string, listener: (payload: any) => void) => unknown }} callCenter */
function wireDemoControls(callCenter) {
  buttonElement('#demo-open').addEventListener('click', () => {
    buttonElement('.waicc-fab').click();
    textareaElement('.waicc-input').value = selectElement('#demo-transcript').value;
  });
  inputElement('#help-search').addEventListener('input', (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    addLog(`Search changed: ${target?.value || 'empty'}`);
  });
  callCenter.on('state', ({ state }) => document.body.dataset.callState = state);
}

/** @param {{ on: (event: string, listener: (payload: any) => void) => unknown }} callCenter */
function wireCallCenterEvents(callCenter) {
  callCenter.on('progress', (event) => addLog(`${event.area || 'model'} ${event.phase || 'progress'} ${event.progress ?? 0}%`));
  callCenter.on('action', (event) => addLog(`Action ${event.id}: ${event.status}`));
  callCenter.on('error', (event) => addLog(`Error in ${event.area}: ${event.message}`));
}

function announceWasmSpeechMode() {
  textElement('#speech-mode').textContent =
    `WASM speech mode: STT ${STT_MODEL_ID} (${STT_DTYPE}) and Piper TTS ${TTS_VOICE}. Click Prepare before Voice.`;
}

/** @param {string} message */
function addLog(message) {
  const item = document.createElement('li');
  item.textContent = message;
  listElement('#action-log').prepend(item);
}

/** @param {string} selector */
function buttonElement(selector) {
  return requiredElement(selector, HTMLButtonElement);
}

/** @param {string} selector */
function inputElement(selector) {
  return requiredElement(selector, HTMLInputElement);
}

/** @param {string} selector */
function listElement(selector) {
  return requiredElement(selector, HTMLOListElement);
}

/** @param {string} selector */
function selectElement(selector) {
  return requiredElement(selector, HTMLSelectElement);
}

/** @param {string} selector */
function textareaElement(selector) {
  return requiredElement(selector, HTMLTextAreaElement);
}

/** @param {string} selector */
function textElement(selector) {
  return requiredElement(selector, HTMLElement);
}

/**
 * @template {Element} T
 * @param {string} selector
 * @param {new (...args: any[]) => T} Type
 * @returns {T}
 */
function requiredElement(selector, Type) {
  const element = document.querySelector(selector);
  if (element instanceof Type) return element;
  throw new Error(`Missing required demo element: ${selector}`);
}
