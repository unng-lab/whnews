import initialCatalog from '~/content/catalog.json';
import { reactive } from 'vue';
import { sortNews } from './catalog.mjs';

export const catalog = reactive(structuredClone(initialCatalog));
export const stories = reactive(sortNews(catalog.news));
const byName = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
export const people = reactive(byName(catalog.actors));
export const worlds = reactive(byName(catalog.worlds ?? []));
export const systems = reactive(byName(catalog.systems ?? []));

// Retain array identities for mounted pages and client-side navigation.
export function updateCatalog(next) {
  const sorted = [sortNews(next.news), byName(next.actors), byName(next.worlds ?? []), byName(next.systems ?? [])];
  Object.assign(catalog, next, { worlds: next.worlds ?? [], systems: next.systems ?? [] });
  [stories, people, worlds, systems].forEach((items, index) => items.splice(0, items.length, ...sorted[index]));
}
