export const PAGE_SIZE = 20;

export function sortNews(news) {
  return [...news].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id, 'en'));
}

export function actorNews(news, actorId) {
  return sortNews(news.filter(story => story.actorIds.includes(actorId)));
}

export function searchActors(actors, query = '') {
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  const needle = normalize(query);
  return actors.filter(actor => normalize(actor.name).includes(needle));
}

export function pageSlice(items, page = 1, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  if (!Number.isInteger(page) || page < 1 || page > totalPages) throw new RangeError('Unknown page');
  return { items: items.slice((page - 1) * size, page * size), page, totalPages, totalItems: items.length,
    previous: page > 1 ? page - 1 : null, next: page < totalPages ? page + 1 : null };
}

export function parsePage(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

export const newsHref = id => `/news/${encodeURIComponent(id)}/`;
export const actorHref = id => `/actors/${encodeURIComponent(id)}/`;
export const placeHref = (kind, id) => `/${kind}/${encodeURIComponent(id)}/`;

export function effectiveSystemIds(story, worlds = []) {
  const worldIds = new Set(story.worldIds ?? []);
  return [...new Set([...(story.systemIds ?? []), ...worlds.filter(world => worldIds.has(world.id)).flatMap(world => world.systemIds)])].sort();
}

export function placeNews(catalog, kind, id) {
  return sortNews(catalog.news.filter(story => kind === 'worlds'
    ? (story.worldIds ?? []).includes(id)
    : effectiveSystemIds(story, catalog.worlds).includes(id)));
}
export const pageHref = (base, page) => page === 1 ? base : `${base}page/${page}/`;

export function pageNumbers(total, current) {
  const selected = [...new Set([1, total, current - 1, current, current + 1].filter(n => n >= 1 && n <= total))].sort((a, b) => a - b);
  return selected.flatMap((n, i) => i && n - selected[i - 1] > 1 ? [null, n] : [n]);
}

export function staticRoutes(catalog) {
  const routes = new Set(['/', '/news/', '/actors/', '/worlds/', '/systems/', '/characters/']);
  const addPages = (base, items) => {
    for (let n = 1; n <= Math.max(1, Math.ceil(items.length / PAGE_SIZE)); n++) routes.add(`${base}page/${n}/`);
  };
  addPages('/news/', catalog.news);
  addPages('/actors/', catalog.actors);
  for (const story of catalog.news) routes.add(newsHref(story.id));
  for (const actor of catalog.actors) {
    routes.add(actorHref(actor.id));
    addPages(actorHref(actor.id), actorNews(catalog.news, actor.id));
  }
  for (const kind of ['worlds', 'systems']) {
    addPages(`/${kind}/`, catalog[kind] ?? []);
    for (const place of catalog[kind] ?? []) {
      routes.add(placeHref(kind, place.id));
      addPages(placeHref(kind, place.id), placeNews(catalog, kind, place.id));
    }
  }
  return [...routes].sort();
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date(value));
}
