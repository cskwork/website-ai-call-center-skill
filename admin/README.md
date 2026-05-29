# No-code admin builder

A standalone React + [React Flow](https://reactflow.dev) SPA that lets a non-developer
compose a conversation **flow** on a canvas and export a **config bundle**
(`schemas/config-bundle.schema.json` v2). The exported JSON is consumed verbatim by the
runtime SDK's `createFlowEngine` — no code changes per domain.

It is deliberately **decoupled** from the SDK: its own `package.json` and dependencies
(`@xyflow/react`, `react`, `ajv`) live here so the published SDK keeps zero new runtime
deps. The admin only consumes the public schema; at test time it imports `../src/api.js`
to prove the round-trip.

## Develop

```bash
npm install --prefix admin   # from the repo root
npm run dev   --prefix admin  # Vite dev server
npm run build --prefix admin  # production build -> admin/dist
npm test      --prefix admin  # node --test on the pure lib + engine round-trip
```

## What it does

- **Canvas + palette** — add and connect the 8 engine node kinds (`start`, `message`,
  `intent-branch`, `slot-fill`, `action`, `ai-disclosure`, `handoff`, `end`).
- **Inspector** — edit the selected node's `data` fields, or an edge's routing
  (`none` = default edge / `intent` shorthand / raw-JSON `condition`).
- **Metadata form** — tenant, domain, intent model, disclosure; `intents` / `scenarios`
  as raw-JSON textareas (required by the schema; not the focus of this builder).
- **Import / Export** — load an existing bundle to edit, or export a bundle that is
  Ajv-validated before download. An invalid bundle or an unparseable edge condition
  blocks export with a friendly message.

## Design

All serialization and validation lives in `src/lib/` as framework-free modules so it is
unit-testable without a browser:

- `flow-bundle.js` — `bundleToFlow` / `flowToBundle` (strips React Flow runtime-only
  fields; materializes an edge `condition` string into the engine's expression object).
- `validate-bundle.js` — Ajv 2020-12 with both schemas added by `$id`.
- `node-kinds.js` — the node/edge field registry, mirroring what `src/engine/flow-engine.js`
  reads.

React components in `src/components/` are thin and import the lib. UI correctness is
covered by the build; logic by `node --test`.

## Scope (MVP)

Deferred: industry template packs, backend/tenant persistence, live two-way handoff,
a visual condition builder, undo/redo, theming. See `log/changelog-2026-05-30.md`.
