import catalog from '~/content/catalog.json';
import { sortNews } from './catalog.mjs';

export { catalog };
export const stories = sortNews(catalog.news);
export const people = [...catalog.actors].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
export const worlds = [...(catalog.worlds ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
export const systems = [...(catalog.systems ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
