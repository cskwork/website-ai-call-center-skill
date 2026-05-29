// Thin browser-only IO helpers for importing/exporting JSON files. Kept out of
// the React components so the App stays declarative. DOM-only (Blob, FileReader,
// URL.createObjectURL): not covered by node --test by design.

/**
 * Trigger a client-side download of a JSON object as a pretty-printed file.
 * @param {string} filename Suggested download name (e.g. "tenant.bundle.json").
 * @param {unknown} obj Serializable object.
 * @returns {void}
 */
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Config bundles are small JSON files; reject anything implausibly large before
// parsing so a mis-selected huge file cannot spike memory / hang the tab.
const MAX_IMPORT_BYTES = 5_000_000;

/**
 * Read a user-selected File as parsed JSON. Rejects with a friendly message on
 * read failure, oversize input, or invalid JSON so the caller can surface it
 * without crashing.
 * @param {File} file File from an <input type="file"> change event.
 * @returns {Promise<unknown>} Parsed JSON value.
 */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (file && file.size > MAX_IMPORT_BYTES) {
      reject(new Error('That file is too large to be a config bundle.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('That file is not valid JSON.'));
      }
    };
    reader.readAsText(file);
  });
}
