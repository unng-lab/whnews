import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actorNews, actorHref, newsHref, pageSlice, pageHref, pageNumbers, searchActors, sortNews, staticRoutes, parsePage, formatDate, formatPublicationDate } from '../utils/catalog.mjs';

const stories = [
  { id: 'old', date: '2025-04-14', actorIds: ['a'] },
  { id: 'b', date: '2026-11-16T12:00:00Z', actorIds: ['a', 'b'] },
  { id: 'a', date: '2026-11-16T12:00:00Z', actorIds: ['b'] },
];

test('publication date shows Moscow date and time across midnight', () => {
  assert.match(formatPublicationDate('2026-11-19T20:59:59Z'), /^19 ноября 2026.*\b23:59$/);
  assert.match(formatPublicationDate('2026-11-19T21:00:00Z'), /^20 ноября 2026.*\b00:00$/);
  assert.match(formatPublicationDate('2026-11-19T21:04:59.123456Z'), /^20 ноября 2026.*\b00:04$/);
});

test('publication date retains calendar-only precision for archival stories', () => {
  const archiveDate = '2025-04-14';
  assert.equal(formatPublicationDate(archiveDate), formatDate(archiveDate));
  assert.match(formatPublicationDate(archiveDate), /^14 апреля 2025[^:]*$/);
});

test('publication date adds time separately from the existing source date format', () => {
  const timestamp = '2026-11-19T21:04:00Z';
  assert.match(formatDate(timestamp), /^20 ноября 2026[^:]*$/);
  assert.match(formatPublicationDate(timestamp), /\b00:04$/);
});

test('newest news first, stable id ties, without changing source data', () => {
  assert.deepEqual(sortNews(stories).map(x => x.id), ['a', 'b', 'old']);
  assert.deepEqual(stories.map(x => x.id), ['old', 'b', 'a']);
});

test('actor collections contain only linked stories, in the same order', () => {
  assert.deepEqual(actorNews(stories, 'a').map(x => x.id), ['b', 'old']);
  assert.deepEqual(actorNews(stories, 'missing'), []);
});

test('pagination preserves all 41 records and defines valid empty results', () => {
  const records = Array.from({ length: 41 }, (_, i) => i);
  assert.equal(pageSlice(records, 1).items.length, 20);
  assert.equal(pageSlice(records, 2).items.length, 20);
  assert.deepEqual(pageSlice(records, 3).items, [40]);
  assert.equal(pageSlice(records, 3).next, null);
  assert.equal(pageSlice(records, 1).previous, null);
  assert.equal(pageSlice([], 1).totalPages, 1);
  assert.deepEqual([1, 2, 3].flatMap(page => pageSlice(records, page).items), records);
  for (const page of [0, -1, 4, 1.5, NaN]) assert.throws(() => pageSlice(records, page), RangeError);
});

test('search uses full catalogue, case-insensitive names and ё/е equivalence', () => {
  const actors = [{ id: '1', name: 'Ёж-Прайм' }, { id: '2', name: 'Лорд Мороза' }];
  assert.deepEqual(searchActors(actors, 'ЕЖ').map(x => x.id), ['1']);
  assert.deepEqual(searchActors(actors, '  МОРОЗА  ').map(x => x.id), ['2']);
  assert.deepEqual(searchActors(actors, 'absent'), []);
  assert.equal(searchActors(actors, '').length, 2);
});

test('static route inventory covers every story, actor and continuation', () => {
  const data = { news: Array.from({ length: 21 }, (_, i) => ({ id: `news-${i}`, date: '2025-01-01', actorIds: ['actor-0'] })),
    actors: Array.from({ length: 22 }, (_, i) => ({ id: `actor-${i}`, name: `Name ${i}` })) };
  const routes = staticRoutes(data);
  for (const path of ['/news/news-20/', '/news/page/2/', '/actors/page/2/', '/actors/actor-0/page/2/', '/actors/actor-21/', '/worlds/', '/systems/']) assert.ok(routes.includes(path), path);
  assert.equal(new Set(routes).size, routes.length);
  assert.ok(!routes.includes('/actors/actor-21/page/2/'));
});

test('URLs and page parsing do not silently accept invalid navigation', () => {
  assert.equal(newsHref('a b'), '/news/a%20b/');
  assert.equal(actorHref('x'), '/actors/x/');
  assert.equal(pageHref('/actors/', 1), '/actors/');
  assert.equal(pageHref('/actors/', 2), '/actors/page/2/');
  assert.equal(parsePage('2'), 2);
  for (const input of ['02', '1.5', '-1', '0', '3oops', [], undefined]) assert.equal(parsePage(input), null);
  const numbers = pageNumbers(50, 25);
  assert.ok(numbers.includes(1) && numbers.includes(25) && numbers.includes(50));
  assert.ok(numbers.includes(null));
});

test('migration preserves every archived text and the 20 original portraits', () => {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const catalog = read('../content/catalog.json');
  const oldNews = [1, 2, 3, 4, 5].flatMap(n => read(`../public/news/page-${n}.json`));
  const oldActors = [1, 2, 3].flatMap(n => read(`../public/leaders/page-${n}.json`));
  assert.equal(catalog.news.filter(story => story.id.startsWith('archive-')).length, 50);
  assert.equal(catalog.actors.length >= 22, true);
  for (const [index, old] of oldNews.entries()) {
    const story = catalog.news.find(item => item.id === `archive-${String(index + 1).padStart(3, '0')}`);
    assert.equal(story.text, old.text);
    assert.equal(story.date, old.date);
    assert.equal(story.source, null);
    assert.deepEqual(story.actorIds, []);
  }
  let portraits = 0;
  for (const old of oldActors) {
    const actor = catalog.actors.find(item => item.name === old.name);
    assert.ok(actor, old.name);
    assert.equal(actor.description, old.description);
    if (old.image) { assert.equal(actor.image, old.image); portraits++; }
  }
  assert.equal(portraits, 20);
});
