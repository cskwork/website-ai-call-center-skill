/**
 * @typedef {object} IntentCandidate
 * @property {string} id Intent id.
 * @property {string[]} [terms] Keyword terms (unused here).
 * @property {string[]} [utterances] Example utterances (EN+KO union) used as prototypes.
 */

/**
 * @typedef {object} EmbeddingResolverOptions
 * @property {string} [model] Transformers.js feature-extraction model id.
 * @property {string} [dtype] Quantization dtype passed to the pipeline.
 * @property {string} [prefix] Per-input instruction prefix (e5 needs 'query: ').
 * @property {(args: { model: string, dtype: string, onProgress?: Function }) => Promise<Function>} [loadExtractor]
 *   Injection seam: resolves to an extractor(text, opts) => { data }.
 */

/**
 * Create an opt-in, CPU/WASM embedding intent resolver implementing the same
 * IntentResolver contract as createKeywordIntentResolver. It scores the input by
 * MAX cosine similarity against each intent's prototype utterance vectors and
 * returns the best intent. Cosine equals the dot product because the extractor
 * yields L2-normalized vectors, so scores fall in 0..1.
 *
 * Contract (shared by every IntentResolver):
 * - `prepare(onProgress?)`: idempotent lazy model load; caches the in-flight
 *   promise so concurrent prepare()/classify() load the model exactly once.
 * - `classify(text, { intents, locale? })`: returns the best intent; mirrors the
 *   keyword resolver's reduce init `{ intent: null, score: 0 }` so an
 *   all-non-positive result yields `intent: null`.
 *
 * The default loader is the ONLY place that touches Transformers.js and imports
 * it via a lazy dynamic `import()`, so the no-download keyword default stays
 * byte-identical and offline; embedding is strictly opt-in.
 *
 * @param {EmbeddingResolverOptions} [options]
 * @returns {{ prepare: (onProgress?: Function) => Promise<void>,
 *   classify: (text: string, ctx: { intents?: IntentCandidate[], locale?: string }) =>
 *     Promise<{ intent: string|null, score: number, scores: Array<{ intent: string, score: number }> }> }}
 */
export function createEmbeddingIntentResolver(options = {}) {
  const model = options.model || 'Xenova/multilingual-e5-small';
  const dtype = options.dtype || 'int8';
  const prefix = options.prefix ?? (/e5/i.test(model) ? 'query: ' : '');
  const loadExtractor = options.loadExtractor || defaultLoadExtractor;

  let extractorPromise = null;
  let extractor = null;
  let protoCacheKey = null;
  let protoCache = null;

  function prepare(onProgress) {
    if (!extractorPromise) {
      extractorPromise = loadExtractor({ model, dtype, onProgress }).then((loaded) => {
        extractor = loaded;
        return loaded;
      });
    }
    return extractorPromise.then(() => undefined);
  }

  async function embed(text) {
    const output = await extractor(prefix + text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  // Build (and memoize) prototype vectors keyed by the intents set so repeated
  // turns on the same intents do not re-embed utterances.
  async function prototypesFor(intents) {
    const key = intentsCacheKey(intents);
    if (protoCache && protoCacheKey === key) return protoCache;
    const built = [];
    for (const intent of intents) {
      const vecs = [];
      for (const utterance of intent.utterances || []) vecs.push(await embed(utterance));
      built.push({ intent: intent.id, vecs });
    }
    protoCache = built;
    protoCacheKey = key;
    return built;
  }

  async function classify(text, { intents = [] } = {}) {
    if (intents.length === 0) return { intent: null, score: 0, scores: [] };
    await prepare();
    const protos = await prototypesFor(intents);
    const queryVec = await embed(String(text || ''));
    const scores = protos.map((proto) => ({
      intent: proto.intent,
      score: maxCosine(queryVec, proto.vecs),
    }));
    const best = scores.reduce(
      (top, entry) => (entry.score > top.score ? entry : top),
      { intent: null, score: 0 },
    );
    return { intent: best.intent, score: best.score, scores };
  }

  return { prepare, classify };
}

/**
 * Default loader: lazily import Transformers.js (kept dynamic so the keyword
 * default never pulls it in), force single-thread CPU/WASM, and return a
 * feature-extraction pipeline.
 *
 * @param {{ model: string, dtype: string, onProgress?: Function }} args
 * @returns {Promise<Function>} extractor(text, { pooling, normalize }) => { data }
 */
async function defaultLoadExtractor({ model, dtype, onProgress }) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.backends.onnx.wasm.numThreads = 1;
  return pipeline('feature-extraction', model, { dtype, progress_callback: onProgress });
}

/** Dot product; equals cosine for L2-normalized vectors. */
function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/**
 * Max cosine of `query` over `vecs`; 0 when there are no prototype vectors.
 * Negative cosines (anti-correlated) are floored to 0 so reported scores stay
 * in 0..1, matching the keyword resolver's non-negative scores.
 */
function maxCosine(query, vecs) {
  let best = 0;
  for (const vec of vecs) {
    const score = cosine(query, vec);
    if (score > best) best = score;
  }
  return best;
}

/**
 * Stable cache key over the intents set (ids + utterances), order-sensitive.
 * Length-prefixes every field so ids/utterances cannot collide across distinct
 * intent sets regardless of their contents (no reliance on delimiter chars).
 */
function intentsCacheKey(intents) {
  const field = (value) => `${value.length}:${value}`;
  return intents
    .map((intent) => field(intent.id) + (intent.utterances || []).map(field).join(''))
    .join('');
}
