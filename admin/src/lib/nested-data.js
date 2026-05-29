// Tiny immutable get/set for dot-path keys (e.g. 'i18n.ko.text'). Used by the
// inspector so editing a nested message-translation field never mutates the
// selected node's data in place. Pure, framework-free, node-testable.

/**
 * Read a dot-path value from an object, or undefined if any segment is missing.
 * @param {object} obj
 * @param {string} path Dot path, e.g. 'i18n.ko.text'.
 * @returns {unknown}
 */
export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Return a NEW object with the dot-path set to value (intermediate objects
 * cloned). When value is an empty string, the leaf key is removed and any
 * intermediate object left empty is pruned, so cleared optional fields do not
 * persist empty husks in the exported bundle.
 *
 * @param {object} obj Source object (not mutated).
 * @param {string} path Dot path.
 * @param {unknown} value New value; '' removes the key.
 * @returns {object} New object.
 */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  return assign(obj ?? {}, keys, value);
}

function assign(node, keys, value) {
  const [head, ...rest] = keys;
  const copy = { ...node };
  if (rest.length === 0) {
    if (value === '' || value === undefined) delete copy[head];
    else copy[head] = value;
    return copy;
  }
  const child = assign(node[head] ?? {}, rest, value);
  if (Object.keys(child).length === 0) delete copy[head];
  else copy[head] = child;
  return copy;
}
