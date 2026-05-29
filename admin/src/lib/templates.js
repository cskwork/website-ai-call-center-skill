// Starter templates for the Flow Builder. These import the prebuilt, schema-valid
// config bundles (the same public artifacts the builder exports) so a new user can
// open a working multi-node flow instead of a blank canvas. Only bundles that carry
// a non-empty graph flow are offered: support ships an empty flow for the legacy
// keyword path, so it is intentionally excluded here.
import finance from '../../../bundles/finance.bundle.json';
import education from '../../../bundles/education.bundle.json';
import insurance from '../../../bundles/insurance.bundle.json';

/** @type {ReadonlyArray<{ id: string, label: string, bundle: object }>} */
export const TEMPLATES = Object.freeze([
  { id: 'finance', label: 'Finance', bundle: finance },
  { id: 'education', label: 'Education', bundle: education },
  { id: 'insurance', label: 'Insurance', bundle: insurance },
]);

/**
 * Find a template bundle by id.
 * @param {string} id Template id.
 * @returns {object|null} The bundle, or null when the id is unknown.
 */
export function templateBundle(id) {
  return TEMPLATES.find((template) => template.id === id)?.bundle ?? null;
}
