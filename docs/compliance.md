# Compliance surface

This SDK makes AI-use disclosure and written governance first-class, config-driven
features. They are documentation and transparency surfaces — **not legal advice, and
not a substitute for your own compliance review.** The prebuilt domain templates are
illustrative scaffolding; replace the copy and have your own legal, compliance, and
security teams review before production use.

See also [privacy.md](./privacy.md) for the data-residency and cache model.

## AI-use disclosure

The bundle's `disclosure` block tells users they are talking to an AI:

```jsonc
"disclosure": {
  "required": true,
  "showOn": "first-interaction",   // first-interaction | every-session | off
  "text": { "en": "You are chatting with an AI assistant.", "ko": "AI 도우미와 대화 중입니다." }
}
```

At runtime the disclosure is rendered exactly once per session on the first
interaction. There are two equivalent ways to surface it, and the engine never
double-prints:

- an `ai-disclosure` flow node placed right after `start` (the node owns the text), or
- no node, in which case the engine prepends `disclosure.text` to the first reply.

Why it is required by default: in-conversation AI disclosure is a cross-jurisdiction
obligation that recurs across the NAIC model bulletin (insurance) and the EU AI Act
Art. 50 (applicable 2026-08-02). **Client-side data residency does not waive the
disclosure obligation** — keeping text in the browser does not make the bot exempt
from telling the user it is an AI.

## Written-governance metadata

The `governance` block is a per-tenant documentation surface modeled on the NAIC AIS
Program style:

```jsonc
"governance": {
  "owner": "compliance@acme",
  "modelVersions": { "intent": "keyword", "llm": null },
  "lastReviewed": "2026-05-30",
  "notes": "AIS Program reference / review scope ..."
}
```

It records who owns the bot, which models it runs, and when it was last reviewed. It
satisfies a *written governance documentation* requirement **as documentation**; the
platform does not inherit the tenant's full compliance burden.

## Domain notes (not exhaustive)

- **Finance** is technology-neutral (FINRA Notice 24-09, ESMA): in-house, vendor, or
  embedded, the obligation attaches to the member firm. Client-side execution does
  **not** exempt you from regulatory duties — do not market "data stays in the browser"
  as a compliance exemption. (SEC predictive-data-analytics proposal was withdrawn
  2025-06; non-binding.)
- **Education** (FERPA): the school-official exception is contractual — the vendor must
  perform a function the school would otherwise do, under the school's direct control of
  education records. A client-side architecture helps demonstrate control but does not
  remove the contractual requirement.
- **Open items requiring legal review before go-live**: PCI-DSS scope, GDPR
  controller/processor roles, and microphone-capture consent are not settled here and
  must be reviewed per deployment.

## Enforced contract

`tests/compliance.test.mjs` asserts that every shipped bundle in `bundles/` carries a
complete `governance` block and a bilingual `disclosure`, and drives `createFlowEngine`
to confirm the disclosure actually renders once on the first interaction. A template
that drops either fails the test suite.
