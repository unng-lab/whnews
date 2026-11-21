import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parse, walkSync, ELEMENT_NODE } from 'ultrahtml';
import { staticRoutes } from '../utils/catalog.mjs';
import { validateRadioProgram } from '../utils/radio-program.mjs';
import { validateVoiceRuntime } from '../utils/radio-speech.mjs';

const siteOrigin = 'https://lifeisbetter.ru';
const check = (condition, message) => { if (!condition) throw new Error(message); };
const exact = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...names].sort().join(',');
const plain = value => typeof value === 'string' && value.trim().length > 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f<>]/u.test(value);
const utc = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));

export function inside(root, path) {
  const base = resolve(root), target = resolve(root, path), suffix = relative(base, target);
  check(suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix), 'Path escapes output root');
  return target;
}

export function filesIn(root) {
  const result = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      check(!entry.isSymbolicLink(), `Symlink is not permitted: ${path}`);
      if (entry.isDirectory()) visit(path);
      else { check(entry.isFile(), `Unsupported file: ${path}`); result.push(relative(root, path).split(sep).join('/')); }
    }
  }
  check(!lstatSync(root).isSymbolicLink(), 'Output root must not be a symlink');
  visit(root);
  return result.sort();
}

export function validateCatalog(catalog) {
  const version = catalog?.schemaVersion;
  check(exact(catalog, version === 2 ? ['schemaVersion', 'actors', 'news', 'worlds', 'systems'] : ['schemaVersion', 'actors', 'news']) && [1, 2].includes(version) &&
    Array.isArray(catalog.actors) && Array.isArray(catalog.news), 'Invalid catalog schema');
  const places = { worlds: new Set(), systems: new Set() };
  const refs = (value, known) => Array.isArray(value) && new Set(value).size === value.length && value.every(id => known.has(id));
  if (version === 2) {
    for (const [kind, prefix] of [['systems', 's'], ['worlds', 'w']]) {
      check(Array.isArray(catalog[kind]), 'Invalid geography collection');
      for (const place of catalog[kind]) {
        check(exact(place, kind === 'worlds' ? ['id', 'name', 'description', 'systemIds'] : ['id', 'name', 'description']), 'Invalid place fields');
        check(typeof place.id === 'string' && place.id.length <= 80 && new RegExp(`^${prefix}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(place.id) && !places[kind].has(place.id), 'Invalid or duplicate place ID');
        places[kind].add(place.id);
        check(plain(place.name) && [...place.name.trim()].length <= 160 && plain(place.description) && [...place.description.trim()].length <= 500 && !/[\p{C}<>]/u.test(place.name + place.description), 'Invalid place text');
        if (kind === 'worlds') check(refs(place.systemIds, places.systems), 'Invalid world system references');
      }
    }
  }
  const actors = new Set(), stories = new Set(), sources = new Set();
  for (const actor of catalog.actors) {
    check(exact(actor, ['id', 'name', 'description', 'image']), 'Invalid actor fields');
    check(/^a-[a-f0-9]{16}$/.test(actor.id) && !actors.has(actor.id), 'Invalid or duplicate actor ID');
    actors.add(actor.id);
    check(plain(actor.name) && actor.name.length <= 160 && plain(actor.description), 'Invalid actor text');
    check(actor.image === null || (typeof actor.image === 'string' && /^\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/.test(actor.image) &&
      !actor.image.split('/').includes('..')), `Portrait is unsafe: ${actor.id}`);
  }
  for (const story of catalog.news) {
    check(exact(story, version === 2 ? ['id', 'title', 'text', 'date', 'source', 'actorIds', 'worldIds', 'systemIds'] : ['id', 'title', 'text', 'date', 'source', 'actorIds']), 'Invalid story fields');
    if (version === 2) check(refs(story.worldIds, places.worlds) && refs(story.systemIds, places.systems), 'Invalid news geography references');
    const archive = /^archive-\d{3}$/.test(story.id);
    check((archive || /^rt-[a-f0-9]{20}$/.test(story.id)) && !stories.has(story.id), 'Invalid or duplicate story ID');
    stories.add(story.id);
    check(plain(story.title) && plain(story.text), 'Invalid story text');
    check(archive || (story.title.length <= 140 && story.text.length >= 300 && story.text.length <= 1500), 'Invalid new story length');
    check(utc(story.date) || (archive && /^\d{4}-\d\d-\d\d$/.test(story.date) && Number.isFinite(Date.parse(story.date))), 'Invalid publication date');
    check(Array.isArray(story.actorIds) && new Set(story.actorIds).size === story.actorIds.length &&
      story.actorIds.every(id => actors.has(id)), 'Unknown or duplicate actor reference');
    if (archive) { check(story.source === null, 'Archive provenance must remain unknown'); continue; }
    check(story.actorIds.every(id => catalog.actors.find(actor => actor.id === id).image !== null), 'New story actor has no portrait');
    check(exact(story.source, ['name', 'url', 'publishedAt']) && story.source.name === 'RT на русском', 'Invalid source');
    let url;
    try { url = new URL(story.source.url); } catch { throw new Error('Invalid source URL'); }
    check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash, 'Unsafe source URL');
    const key = url.href;
    check(!sources.has(key), 'Duplicate source URL'); sources.add(key);
    check(story.source.publishedAt === null || utc(story.source.publishedAt), 'Invalid source date');
  }
}

// The validator reads generated files only; no HTTP requests or application runtime.
export function validateStatic({ catalog, output }) {
  validateCatalog(catalog);
  const result = validateReferences({ catalog, output });
  const files = new Set(filesIn(resolve(output)));
  if (files.has('radio/program.json')) {
    const root = resolve(output), read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
    const music = JSON.parse(readFileSync(new URL('../content/radio.json', import.meta.url), 'utf8'));
    const program = validateRadioProgram(read('radio/program.json'), music);
    if (program.catalog !== undefined) check(isDeepStrictEqual(program.catalog, music), 'Radio program embeds a different catalog');
    const runtime = validateVoiceRuntime(read('radio/voice/runtime-v1.json'));
    check(program.modelRevision === runtime.model.sha256 && program.fallbackSrc === runtime.fallbackSrc, 'Radio runtime edition differs');
    for (const entry of [runtime.model, runtime.config]) {
      const bytes = readFileSync(join(root, entry.src.slice(1)));
      check(createHash('sha256').update(bytes).digest('hex') === entry.sha256, 'Radio asset hash differs');
    }
    for (const path of [program.fallbackSrc, ...['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'LICENSE.txt'].map(name => runtime.ort.baseUrl + name)])
      check(files.has(path.slice(1)), `Missing radio runtime: ${path}`);
    for (const bank of program.banks) for (const dialogue of bank.dialogues)
      check(catalog.news.some(story => story.id === dialogue.storyId), 'Radio refers to unknown story');
  }
  return result;
}

// Useful for diagnosing a draft catalog; this does not establish release readiness.
export function validateReferences({ catalog, output }) {
  const root = realpathSync(output);
  check(root === resolve(output), 'Output path must not traverse symlinks');
  const files = filesIn(root), available = new Set(files);
  const requireFile = (path, context) => check(available.has(path), `Missing local file: ${path} (${context})`);
  for (const route of staticRoutes(catalog)) requireFile(`${route.slice(1)}index.html`, route);
  requireFile('404.html', 'unknown routes');
  for (const actor of catalog.actors) if (actor.image) requireFile(actor.image.slice(1), actor.id);
  let references = 0;
  function reference(value, from) {
    // Attribute entities needed for ordinary static links; content is otherwise plain text.
    const decoded = value.replaceAll('&amp;', '&').replaceAll('&#38;', '&');
    let url;
    try { url = new URL(decoded, new URL(from, `${siteOrigin}/`)); } catch { throw new Error(`Invalid URL in ${from}`); }
    if (url.origin !== siteOrigin || !['http:', 'https:'].includes(url.protocol)) return;
    let path;
    try { path = decodeURIComponent(url.pathname).replace(/^\//, ''); } catch { throw new Error(`Invalid path in ${from}`); }
    inside(root, path);
    if (!path || path.endsWith('/')) path += 'index.html';
    else if (!extname(path)) path += '/index.html';
    requireFile(path, from); references++;
  }
  for (const file of files) {
    if (file.endsWith('.html')) {
      walkSync(parse(readFileSync(join(root, file), 'utf8')), node => {
        if (node.type !== ELEMENT_NODE) return;
        for (const attr of ['href', 'src', 'poster']) if (node.attributes[attr]) reference(node.attributes[attr], file);
        if (node.attributes.srcset) for (const entry of node.attributes.srcset.split(',')) reference(entry.trim().split(/\s+/)[0], file);
        if (node.name === 'img') check(typeof node.attributes.alt === 'string', `Image without alt in ${file}`);
      });
    } else if (file.endsWith('.css')) {
      for (const match of readFileSync(join(root, file), 'utf8').matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) reference(match[1], file);
    }
  }
  return { status: 'valid', routes: staticRoutes(catalog).length, files: files.length, references };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const catalog = JSON.parse(readFileSync(resolve(process.argv[2] ?? join(root, 'content/catalog.json')), 'utf8'));
    console.log(JSON.stringify(validateStatic({ catalog, output: resolve(process.argv[3] ?? join(root, '.output/public')) })));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
