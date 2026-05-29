// Schema validation for config bundles, with non-developer-friendly errors.
// Compiles Ajv (draft 2020-12) ONCE at module load and memoizes the validator.
// config-bundle.schema.json $refs call-scenario.schema.json by its ABSOLUTE
// $id, so call-scenario MUST be addSchema'd before compiling config-bundle or
// the ref will not resolve. Mirrors the verified SDK pattern in
// tests/config-bundle.test.mjs and scripts/build-bundle.mjs.

import Ajv2020 from 'ajv/dist/2020.js';
import { configBundleSchema, callScenarioSchema } from './schemas.js';

let cachedValidate = null;

/**
 * Compile the bundle validator once and reuse it. Both schemas are registered
 * by their declared $id; the config-bundle schema is then compiled.
 * @returns {import('ajv').ValidateFunction}
 */
function getValidator() {
  if (cachedValidate) return cachedValidate;
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(callScenarioSchema);
  cachedValidate = ajv.compile(configBundleSchema);
  return cachedValidate;
}

/**
 * Turn an instancePath like "/tenant/id" into a readable trailing label,
 * e.g. "tenant id". Empty path (root errors) becomes "the bundle".
 * @param {string} instancePath
 * @returns {string}
 */
function humanizePath(instancePath) {
  if (!instancePath) return 'the bundle';
  return instancePath.replace(/^\//, '').replace(/\//g, ' ').replace(/_/g, ' ');
}

/**
 * Map one Ajv error to a non-developer message keyed on the failed keyword.
 * Falls back to the raw Ajv message when no friendly template applies.
 * @param {import('ajv').ErrorObject} err
 * @returns {string}
 */
function friendlyMessage(err) {
  const where = humanizePath(err.instancePath);
  switch (err.keyword) {
    case 'required':
      return `Missing required field "${err.params.missingProperty}" in ${where}.`;
    case 'enum':
      return `${where} must be one of: ${(err.params.allowedValues || []).join(', ')}.`;
    case 'const':
      return `${where} must be "${err.params.allowedValue}".`;
    case 'pattern':
      return `${where} has an invalid format (does not match ${err.params.pattern}).`;
    case 'type':
      return `${where} must be of type ${err.params.type}.`;
    case 'minItems':
      return `${where} needs at least ${err.params.limit} item(s).`;
    case 'minLength':
      return `${where} must not be empty.`;
    case 'additionalProperties':
      return `${where} has an unexpected field "${err.params.additionalProperty}".`;
    default:
      return `${where} ${err.message}.`;
  }
}

/**
 * Validate a config bundle against the v2 schema set. Returns a structured
 * result with friendly {path, message} errors suitable for showing to a
 * non-developer. Never throws on invalid input and never logs.
 *
 * @param {unknown} bundle The parsed bundle object to validate.
 * @returns {{ valid: boolean, errors: Array<{ path: string, message: string }> }}
 */
export function validateBundle(bundle) {
  const validate = getValidator();
  const valid = validate(bundle);
  if (valid) return { valid: true, errors: [] };
  const errors = (validate.errors || []).map((err) => ({
    path: err.instancePath || '/',
    message: friendlyMessage(err),
  }));
  return { valid: false, errors };
}
