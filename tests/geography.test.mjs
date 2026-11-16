import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSystemIds, placeNews, placeHref, staticRoutes, pageSlice, searchActors } from '../utils/catalog.mjs';
import { validateCatalog } from '../tools/validate-static.mjs';

const worlds = [{ id: 'w-a', name: 'Лёд', description: 'Мир льда', systemIds: ['s-a', 's-b'] },
  { id: 'w-b', name: 'Огонь', description: 'Мир огня', systemIds: ['s-a'] }];
const systems = ['a', 'b'].map(id => ({ id: `s-${id}`, name: id, description: 'Система' }));
const story = (id, worldIds, systemIds = []) => ({ id, date: '2025-01-01', title: 'Хроника', text: 'Текст', actorIds: [], source: null, worldIds, systemIds });
const catalog = { schemaVersion: 2, actors: [], worlds, systems, news: [story('archive-001', ['w-a'], ['s-a']), story('archive-002', ['w-b']), story('archive-003', [], ['s-b'])] };

test('place text boundaries match the private validator, counting Unicode code points', () => {
  for (const [field, limit] of [['name', 160], ['description', 500]]) {
    for (const value of ['Ice share < 10%', 'Ice share > 10%', 'line\nbreak', 'bad\u202etext', 'Ice\n', '\nIce', 'Ice\t', '\tIce', 'x'.repeat(limit + 1)]) {
      const broken = structuredClone(catalog); broken.systems[0][field] = value;
      assert.throws(() => validateCatalog(broken), `${field}: ${value}`);
    }
    for (const value of ['Ice share ≤ 10%', '🪐'.repeat(limit), '  Ice  ']) {
      const valid = structuredClone(catalog); valid.systems[0][field] = value;
      assert.doesNotThrow(() => validateCatalog(valid));
    }
  }
});

test('world collections and overlapping system collections have no duplicates or unrelated stories', () => {
  assert.deepEqual(effectiveSystemIds(catalog.news[0], worlds), ['s-a', 's-b']);
  assert.deepEqual(placeNews(catalog, 'worlds', 'w-a').map(x => x.id), ['archive-001']);
  assert.deepEqual(placeNews(catalog, 'systems', 's-a').map(x => x.id), ['archive-001', 'archive-002']);
  assert.deepEqual(placeNews(catalog, 'systems', 's-b').map(x => x.id), ['archive-001', 'archive-003']);
  assert.deepEqual(placeNews(catalog, 'worlds', 'w-unknown'), []);
  assert.deepEqual(effectiveSystemIds({ actorIds: [] }, worlds), []);
  assert.deepEqual(searchActors(worlds, 'ЛЕД').map(x => x.id), ['w-a']);
});

test('all directories and collection pages are statically enumerated, including empty profiles', () => {
  const data = structuredClone(catalog);
  data.news = Array.from({ length: 21 }, (_, i) => story(`archive-${String(i + 1).padStart(3, '0')}`, ['w-a']));
  data.worlds.push(...Array.from({ length: 20 }, (_, i) => ({ ...worlds[1], id: `w-other-${i}` })));
  const routes = staticRoutes(data);
  for (const path of ['/worlds/page/2/', '/worlds/w-a/page/2/', '/systems/s-a/page/2/', '/worlds/w-b/', '/systems/s-b/']) assert.ok(routes.includes(path), path);
  assert.ok(!routes.includes('/worlds/w-b/page/2/'));
  assert.equal(placeHref('worlds', 'a b'), '/worlds/a%20b/');
  assert.equal(pageSlice(placeNews(data, 'systems', 's-b'), 2).items.length, 1);
  assert.throws(() => pageSlice([], 2), RangeError);
  assert.doesNotThrow(() => staticRoutes({ actors: [], news: [] }));
});

test('v1/v2 validators agree on strict version fields and geography references', () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  for (const mutate of [c => c.news[0].worldIds.push('w-missing'), c => c.worlds[0].systemIds.push('s-missing'),
    c => c.news[0].systemIds.push('s-a'), c => c.worlds[0].aliases = ['private'], c => c.schemaVersion = 3,
    c => delete c.news[0].worldIds, c => c.systems[0].description = 'x'.repeat(501), c => c.worlds[0].id = 'w-']) {
    const broken = structuredClone(catalog); mutate(broken);
    assert.throws(() => validateCatalog(broken));
  }
  const legacy = { schemaVersion: 1, actors: [], news: [story('archive-001', [])] };
  delete legacy.news[0].worldIds; delete legacy.news[0].systemIds;
  assert.doesNotThrow(() => validateCatalog(legacy));
});
