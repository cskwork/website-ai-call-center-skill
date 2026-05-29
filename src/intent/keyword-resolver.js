/**
 * @typedef {object} IntentCandidate
 * @property {string} id Intent id.
 * @property {string[]} [terms] Keyword terms (EN+KO union) used by this resolver.
 * @property {string[]} [utterances] Example utterances (used by embedding resolvers).
 */

/**
 * Create a fully client-side, no-download intent resolver that scores the input
 * against each intent's keyword `terms` (length-weighted inclusion on normalized
 * text). This is the zero-infrastructure default; embedding-based resolvers
 * implement the same `classify` contract for higher accuracy at the cost of a
 * one-time model load.
 *
 * Contract (shared by every IntentResolver):
 * - `prepare(onProgress?)`: lazy model load; no-op here.
 * - `classify(text, { intents, locale? })`: returns the best intent.
 *
 * Keyword scores are length-weighted integers (not 0..1); a score of 0 means no
 * keyword matched. Callers apply their own acceptance threshold.
 *
 * @returns {{ prepare: (onProgress?: Function) => Promise<void>,
 *   classify: (text: string, ctx: { intents?: IntentCandidate[], locale?: string }) =>
 *     Promise<{ intent: string|null, score: number, scores: Array<{ intent: string, score: number }> }> }}
 */
export function createKeywordIntentResolver() {
  async function prepare() {}

  async function classify(text, { intents = [] } = {}) {
    const normalized = normalize(text);
    const scores = intents.map((intent) => ({
      intent: intent.id,
      score: scoreTerms(normalized, intent.terms || []),
    }));
    const best = scores.reduce(
      (top, entry) => (entry.score > top.score ? entry : top),
      { intent: null, score: 0 },
    );
    return { intent: best.intent, score: best.score, scores };
  }

  return { prepare, classify };
}

function scoreTerms(text, terms) {
  return terms.reduce((score, term) => {
    const token = normalize(term);
    return token && text.includes(token) ? score + Math.max(1, token.length) : score;
  }, 0);
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}
