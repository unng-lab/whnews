import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive, computed } from 'vue';
import { createCatalogRefresh, validateLiveCatalog } from '../utils/live-catalog.mjs';

const fixture = () => ({ schemaVersion: 2, actors: [{ id: 'a', name: 'Лорд', description: 'Архив' }], worlds: [], systems: [],
  news: [{ id: 'n', title: 'Хроника', text: 'Текст', date: '2026-11-17', actorIds: ['a'], source: null }] });
const response = value => ({ ok: true, json: async () => value });

test('new editions update mounted consumers, unchanged editions do not apply twice', async () => {
  const initial = fixture(), next = fixture();
  next.news.unshift({ ...next.news[0], id: 'new', title: 'Новая хроника' });
  const stories = reactive(initial.news.slice());
  const title = computed(() => stories[0].title);
  assert.equal(title.value, 'Хроника');
  let calls = 0;
  const refresh = createCatalogRefresh({ url: '/chronicles.json', initial,
    fetcher: async (url, options) => { assert.equal(url, '/chronicles.json'); assert.equal(options.cache, 'no-store'); return response(next); },
    apply: data => { calls++; stories.splice(0, stories.length, ...data.news); } });
  await refresh.refresh(); await refresh.refresh();
  assert.equal(title.value, 'Новая хроника'); assert.equal(calls, 1);
  refresh.dispose();
});

test('network errors, HTTP errors and invalid editions retain data and allow recovery', async () => {
  const initial = fixture(), next = fixture(); next.news[0].title = 'Обновлено';
  const invalid = fixture(); invalid.news[0].actorIds = ['missing'];
  const attempts = [() => { throw new Error('offline'); }, () => ({ ok: false }), () => response(invalid), () => response(next)];
  const applied = [];
  const refresh = createCatalogRefresh({ url: '/', initial, apply: value => applied.push(value), fetcher: async () => attempts.shift()() });
  for (let i = 0; i < 3; i++) { await refresh.refresh(); assert.equal(applied.length, 0); }
  await refresh.refresh(); assert.equal(applied.length, 1);
  refresh.dispose();
});

test('overlapping requests are skipped and disposal prevents late updates', async () => {
  let resolve, signal, calls = 0, applied = 0;
  const next = fixture(); next.news[0].title = 'Позднее';
  const refresh = createCatalogRefresh({ url: '/', initial: fixture(), apply: () => applied++, fetcher: async (_, options) => {
    calls++; signal = options.signal; return new Promise(done => { resolve = done; });
  } });
  const pending = refresh.refresh(); await refresh.refresh();
  assert.equal(calls, 1);
  refresh.dispose(); assert.equal(signal.aborted, true);
  resolve(response(next)); await pending; await refresh.refresh();
  assert.equal(applied, 0); assert.equal(calls, 1);
});

test('snapshot rejects unsupported versions, broken geography and malformed fields', () => {
  assert.equal(validateLiveCatalog(fixture()).schemaVersion, 2);
  for (const mutate of [data => data.schemaVersion = 3, data => data.news[0].date = 'invalid',
    data => data.news[0].systemIds = ['missing'], data => data.actors[0].name = null,
    data => data.news.push(data.news[0]), data => data.news[0].source = { url: 'javascript:alert(1)' }]) {
    const data = fixture(); mutate(data); assert.throws(() => validateLiveCatalog(data));
  }
});
