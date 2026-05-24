const DEFAULT_NAMESPACE = 'website-ai-call-center-models';
const MAX_SAFE_NAME = 200;

export function createOpfsCache({ namespace = DEFAULT_NAMESPACE } = {}) {
  let dirHandlePromise = null;
  let unavailable = false;

  async function ensureDir() {
    if (unavailable) return null;
    if (dirHandlePromise) return dirHandlePromise;
    const rootPromise = globalThis.navigator?.storage?.getDirectory?.();
    if (!rootPromise) {
      unavailable = true;
      return null;
    }
    dirHandlePromise = rootPromise.then((root) => root.getDirectoryHandle(namespace, { create: true }));
    return dirHandlePromise.catch(() => {
      unavailable = true;
      dirHandlePromise = null;
      return null;
    });
  }

  async function put(url, response) {
    const dir = await ensureDir();
    if (!dir) return;
    const fileHandle = await dir.getFileHandle(safeName(url), { create: true });
    const writable = await fileHandle.createWritable();
    try { await writable.write(await response.arrayBuffer()); }
    finally { await writable.close(); }
  }

  async function match(url) {
    const dir = await ensureDir();
    if (!dir) return undefined;
    try {
      const file = await (await dir.getFileHandle(safeName(url))).getFile();
      return new Response(await file.arrayBuffer(), { headers: { 'content-type': inferType(url) } });
    } catch {
      return undefined;
    }
  }

  return { put, match, isAvailable: async () => (await ensureDir()) !== null };
}

function safeName(url) {
  const sanitized = String(url).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, MAX_SAFE_NAME);
  return `${sanitized}-${hash32(String(url))}`;
}

function inferType(url) {
  if (String(url).endsWith('.wasm')) return 'application/wasm';
  if (String(url).endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function hash32(input) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = ((hash << 5) + hash + input.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}
