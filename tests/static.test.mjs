import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { staticRoutes } from '../utils/catalog.mjs';
import { validateCatalog, validateStatic } from '../tools/validate-static.mjs';
import { ownedPaths, syncStatic } from '../tools/sync-static.mjs';

const fixture = () => ({ schemaVersion: 1, actors: [{ id: 'a-0123456789abcdef', name: 'Лорд Мороза', description: 'Архивная биография.', image: '/images/old.png' }],
  news: [{ id: 'archive-001', title: 'Старая хроника', text: 'Сохранённый старый текст.', date: '2025-04-14', actorIds: [], source: null }] });
function tree(t) {
  const root = mkdtempSync(join(tmpdir(), 'whnews-static-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, '.output/public'), data = fixture();
  const put = (path, value = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  for (const route of staticRoutes(data)) put(join(output, route.slice(1), 'index.html'), '<html><a href="/actors/">Лица</a><img src="/images/old.png" alt="Лорд"></html>');
  put(join(output, '404.html'), '<html>Не найдено</html>'); put(join(output, 'images/old.png'), 'fixture');
  put(join(root, 'content/catalog.json'), JSON.stringify(data)); put(join(root, 'docs/CNAME'), 'lifeisbetter.ru\n');
  return { root, output, data, put };
}

test('catalog rejects missing portraits, unknown fields, duplicate IDs and unknown actor links', () => {
  validateCatalog(fixture());
  for (const change of [data => data.actors[0].image = null, data => data.actors[0].aliases = ['private'],
    data => data.actors.push(data.actors[0]), data => data.news[0].actorIds = ['missing']]) {
    const data = fixture(); change(data); assert.throws(() => validateCatalog(data));
  }
});

test('static validation checks all routes and local references, without fetching external articles', t => {
  const { output, data, put } = tree(t);
  assert.equal(validateStatic({ catalog: data, output }).status, 'valid');
  put(join(output, 'index.html'), '<a href="https://example.org/not-fetched">RT</a><a href="/missing/">Bad</a>');
  assert.throws(() => validateStatic({ catalog: data, output }), /Missing local file/);
  put(join(output, 'index.html'), '<img src="/images/old.png">');
  assert.throws(() => validateStatic({ catalog: data, output }), /without alt/);
});

test('sync deletes only journal-owned old output and preserves Pages markers', t => {
  const { root, put } = tree(t);
  put(join(root, 'docs/old/index.html'), 'old');
  const releaseId = 'a'.repeat(64);
  syncStatic({ root, releaseId, ownedFiles: ['old/index.html'] });
  assert.equal(existsSync(join(root, 'docs/old/index.html')), false);
  assert.equal(readFileSync(join(root, 'docs/CNAME'), 'utf8'), 'lifeisbetter.ru\n');
  assert.equal(existsSync(join(root, 'docs/.nojekyll')), true);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'docs/release.json'), 'utf8')), { releaseId });
  const ownedFiles = JSON.parse(readFileSync(join(root, 'docs/.whnews-files.json'), 'utf8'));
  syncStatic({ root, releaseId, ownedFiles });
  put(join(root, 'docs/personal.txt'), 'keep me');
  assert.throws(() => syncStatic({ root, releaseId, ownedFiles }), /Unowned/);
  assert.equal(readFileSync(join(root, 'docs/personal.txt'), 'utf8'), 'keep me');
});

test('unsafe ownership paths cannot escape docs', () => {
  for (const path of ['../outside', 'a/../../outside', 'H:/elsewhere', '/absolute', 'a\\b', 'a//b'])
    assert.throws(() => ownedPaths([path]), /Unsafe/);
});
