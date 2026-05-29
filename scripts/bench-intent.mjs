import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// P1 spike: measure in-browser CPU/WASM intent-classification latency for the
// recommended default resolver (Xenova/all-MiniLM-L6-v2 int8 embedding similarity).
// Loads Transformers.js from CDN, embeds the committed bundle's intent prototypes,
// then times cold load and warm per-query inference. Needs network for the model.
//
// Run: node scripts/bench-intent.mjs   (NOT part of npm test — it downloads a model)

const root = path.resolve(new URL('..', import.meta.url).pathname);
const MODEL = process.argv[2] || 'Xenova/all-MiniLM-L6-v2';
const DTYPE = process.argv[3] || 'int8';
// e5 models require an instruction prefix on every input ("query: " for symmetric tasks).
const PREFIX = /e5/i.test(MODEL) ? 'query: ' : '';
const TIMEOUT_MS = 180000;

const bundle = JSON.parse(fs.readFileSync(path.join(root, 'bundles/support.bundle.json'), 'utf8'));
// Prototypes per intent = union of EN + KO utterances, mirroring the keyword
// unionTerms approach in build-scenarios.mjs (so bilingual input matches bilingual prototypes).
const intents = bundle.scenarios.map((s) => ({
  id: s.scenario_intent,
  utterances: [...s.utterances, ...((s.i18n && s.i18n.ko && s.i18n.ko.utterances) || [])],
}));

// Held-out queries with the intent we expect (sanity check, not training data).
const queries = [
  { text: 'where do I change my profile and login', expect: 'account_navigation' },
  { text: 'I hear no sound from my speaker', expect: 'audio_issue' },
  { text: 'my connection looks offline, can you check', expect: 'browser_diagnostics' },
  { text: 'please escalate this to a human agent', expect: 'escalation_ticket' },
  { text: '계정 설정을 못 찾겠어요', expect: 'account_navigation' },
  { text: '소리가 안 들려요', expect: 'audio_issue' },
];

const html = `<!doctype html><meta charset="utf-8"><body><script type="module">
  import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
  env.allowLocalModels = false;            // force fetch from HF Hub
  env.backends.onnx.wasm.numThreads = 1;   // single-thread CPU/WASM (no cross-origin isolation)
  const intents = ${JSON.stringify(intents)};
  const queries = ${JSON.stringify(queries)};
  const prefix = ${JSON.stringify(PREFIX)};
  const now = () => performance.now();
  const cos = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; };
  const embed = async (extractor, text) => {
    const t = await extractor(prefix + text, { pooling: 'mean', normalize: true });
    return Array.from(t.data);
  };
  (async () => {
    try {
      const t0 = now();
      const extractor = await pipeline('feature-extraction', '${MODEL}', { dtype: '${DTYPE}' });
      const warmVec = await embed(extractor, 'warmup');                 // first inference (JIT)
      const coldMs = now() - t0;
      // Precompute intent prototype vectors (max-similarity over each intent's utterances).
      const protos = [];
      for (const intent of intents) {
        const vecs = [];
        for (const u of intent.utterances) vecs.push(await embed(extractor, u));
        protos.push({ id: intent.id, vecs });
      }
      // Warm per-query latency = embedding the query only (proto vectors cached).
      const perQuery = [];
      let correct = 0;
      for (const q of queries) {
        const s = now();
        const v = await embed(extractor, q.text);
        const ms = now() - s;
        let best = { id: null, score: -1 };
        for (const p of protos) {
          const score = Math.max(...p.vecs.map((pv) => cos(v, pv)));
          if (score > best.score) best = { id: p.id, score };
        }
        if (best.id === q.expect) correct++;
        perQuery.push({ text: q.text, predicted: best.id, expected: q.expect, score: +best.score.toFixed(3), ms: +ms.toFixed(1) });
      }
      const warm = perQuery.map((p) => p.ms).sort((a, b) => a - b);
      const median = warm[Math.floor(warm.length / 2)];
      void warmVec;
      window.__bench = {
        ok: true, model: '${MODEL}', dtype: '${DTYPE}',
        coldMs: +coldMs.toFixed(0),
        warmMedianMs: +median.toFixed(1),
        warmMinMs: +warm[0].toFixed(1),
        warmMaxMs: +warm[warm.length - 1].toFixed(1),
        accuracy: correct + '/' + queries.length,
        perQuery,
      };
    } catch (err) {
      window.__bench = { ok: false, error: String(err && err.message || err) };
    }
  })();
</script></body>`;

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('[page]', msg.text()); });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bench, null, { timeout: TIMEOUT_MS });
  const result = await page.evaluate(() => window.__bench);
  if (!result.ok) throw new Error(`bench failed in page: ${result.error}`);
  console.log('bench-intent: ok');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close?.();
}
