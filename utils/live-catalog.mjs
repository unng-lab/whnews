// Validate before replacing the last usable edition, including linked entities.
export function validateLiveCatalog(value) {
  const fail = () => { throw new Error('Invalid live catalog'); };
  if (!value || ![1, 2].includes(value.schemaVersion)) fail();
  const ids = {};
  for (const kind of ['news', 'actors', 'worlds', 'systems']) {
    const items = value[kind] ?? (value.schemaVersion === 1 && ['worlds', 'systems'].includes(kind) ? [] : null);
    if (!Array.isArray(items)) fail();
    ids[kind] = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids[kind].has(item.id)) fail();
      ids[kind].add(item.id);
      const fields = kind === 'news' ? ['title', 'text', 'date'] : ['name', 'description'];
      if (fields.some(field => typeof item[field] !== 'string')) fail();
      if (kind === 'news' && !Number.isFinite(Date.parse(item.date))) fail();
    }
  }
  const refs = (list, kind) => Array.isArray(list) && list.every(id => ids[kind].has(id));
  for (const story of value.news) {
    if (!refs(story.actorIds, 'actors') || !refs(story.worldIds ?? [], 'worlds') || !refs(story.systemIds ?? [], 'systems')) fail();
    if (story.source !== null && (!story.source || typeof story.source.url !== 'string' || !/^https?:\/\//.test(story.source.url))) fail();
  }
  for (const world of value.worlds ?? []) if (!refs(world.systemIds, 'systems')) fail();
  return value;
}

export function createCatalogRefresh({ url, initial, apply, fetcher = fetch, timeoutMs = 10000 }) {
  let edition = JSON.stringify(initial), request, disposed = false;
  return {
    async refresh() {
      if (disposed || request) return;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const next = validateLiveCatalog(await response.json());
        const serialized = JSON.stringify(next);
        if (!disposed && serialized !== edition) { apply(next); edition = serialized; }
      } catch { /* Offline, partial publication or incompatible edition: retry later. */ }
      finally { clearTimeout(timeout); request = null; }
    },
    dispose() { disposed = true; request?.abort(); },
  };
}
