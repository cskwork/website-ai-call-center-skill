// Single indirection point for loading the two JSON schemas the admin validates
// against. Uses ES JSON-module import attributes so the SAME path works in the
// Vite browser build AND under `node --test` (Node 22 supports `with type json`).
// No fs here, so this module stays browser-safe. The schemas themselves live in
// the repo's schemas/ dir and are READ-ONLY for the admin (never modified).

import configBundleSchema from '../../../schemas/config-bundle.schema.json' with { type: 'json' };
import callScenarioSchema from '../../../schemas/call-scenario.schema.json' with { type: 'json' };

export { configBundleSchema, callScenarioSchema };
