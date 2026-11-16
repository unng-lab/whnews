import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesIn, inside, validateStatic } from './validate-static.mjs';

const reserved = new Set(['CNAME', '.nojekyll', 'release.json', '.whnews-files.json']);
const assert = (value, message) => { if (!value) throw new Error(message); };

export function ownedPaths(value) {
  assert(Array.isArray(value) && new Set(value).size === value.length, 'Expected unique owned file paths');
  for (const path of value) assert(typeof path === 'string' && path.length && !path.startsWith('/') &&
    !path.includes('\\') && !path.includes(':') && path.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe owned path');
  return value;
}

export function syncStatic({ root, releaseId, ownedFiles }) {
  assert(/^[a-f0-9]{64}$/.test(releaseId), 'Expected SHA256 release ID');
  const project = realpathSync(root), output = join(project, '.output/public'), docs = join(project, 'docs');
  assert(existsSync(docs) && !lstatSync(docs).isSymbolicLink() && realpathSync(docs) === docs, 'Invalid docs root');
  // Resolve every path and inspect the entire tree before touching it. Symlinks and
  // unowned files stop the operation; ownership is supplied by the private journal.
  const previous = new Set(ownedPaths(ownedFiles));
  const existing = filesIn(docs);
  for (const path of existing) assert(previous.has(path) || reserved.has(path), `Unowned docs file: ${path}`);
  const catalog = JSON.parse(readFileSync(join(project, 'content/catalog.json'), 'utf8'));
  const validation = validateStatic({ catalog, output });
  const cname = readFileSync(join(docs, 'CNAME'), 'utf8').trim();
  assert(cname === 'lifeisbetter.ru', 'Unexpected Pages domain');
  const files = filesIn(output).filter(path => !reserved.has(path));
  for (const path of [...previous, ...files]) inside(docs, path);
  for (const path of files) {
    const target = inside(docs, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(output, path), target);
  }
  const next = new Set(files);
  for (const path of previous) if (!next.has(path) && !reserved.has(path) && existsSync(inside(docs, path))) unlinkSync(inside(docs, path));
  writeFileSync(join(docs, 'CNAME'), `${cname}\n`);
  writeFileSync(join(docs, '.nojekyll'), '');
  writeFileSync(join(docs, 'release.json'), `${JSON.stringify({ releaseId })}\n`);
  writeFileSync(join(docs, '.whnews-files.json'), `${JSON.stringify(files, null, 2)}\n`);
  return { ...validation, releaseId, copied: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const [releaseId, manifest] = process.argv.slice(2);
    assert(manifest, 'Usage: node tools/sync-static.mjs RELEASE_ID OWNED_FILES_JSON');
    console.log(JSON.stringify(syncStatic({ root, releaseId, ownedFiles: JSON.parse(readFileSync(resolve(manifest), 'utf8')) })));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
