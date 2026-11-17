import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveRadioSchedule } from '../utils/radio-program.mjs';
import { createSpeechEngine } from '../utils/radio-speech.mjs';
import { metallicVoice, buildDialogueWave } from '../utils/radio-dsp.mjs';

const sha = n => n.repeat(64);
const epoch = Date.parse('2026-11-17T00:00:00Z');
const iso = ms => new Date(ms).toISOString();
const music = { schemaVersion: 1, epochUtc: iso(epoch), shuffleSeed: 'fixed', tracks: [
  { id: 'a', title: 'Music', src: '/radio/tracks/a.mp3', durationMs: 10000 },
  { id: 'b', title: 'Music B', src: '/radio/tracks/b.mp3', durationMs: 20000 },
] };
const dialogue = (id = 'a') => ({ id: sha(id), storyId: `rt-${id}`, title: 'Хроника', publishedAt: iso(epoch), expiresAt: iso(epoch + 86400000), sourceHref: `/news/rt-${id}/`,
  turns: Array.from({ length: 6 }, (_, i) => ({ voice: i % 2 ? 'B' : 'A', text: 'Тестовая реплика.', chunks: [{ tokens: [1, 2], stress: [0, 1] }] })) });
function fixture() {
  const schedule = createLiveRadioSchedule(music), first = schedule.tracks[0].durationMs;
  const program = { schemaVersion: 2, stationId: 'test', epochUtc: iso(epoch), startIndex: 0, speechWindowMs: 90000, modelRevision: sha('f'), fallbackSrc: '/radio/interlude-abc.mp3',
    banks: [{ id: sha('1'), effectiveAtUtc: iso(epoch + first), dialogues: [dialogue()] }] };
  schedule.update(program);
  return { schedule, program, first };
}
const runtime = { schemaVersion: 1, sampleRate: 24000, model: { src: '/radio/voice/model.onnx', sha256: sha('f') }, config: { src: '/radio/voice/config.json', sha256: sha('e') }, ort: { version: '1.31.1', baseUrl: '/radio/voice/ort-1.31.1/' } };

test('UTC music/dialogue boundaries, cycles, pre-epoch and stale stories are deterministic', () => {
  const { schedule: s, first } = fixture();
  assert.equal(s.atUtc(epoch - 1).kind, 'music');
  assert.equal(s.atUtc(epoch + first - 1).kind, 'music');
  const slot = s.atUtc(epoch + first + 4321);
  assert.equal(slot.kind, 'dialogue'); assert.equal(slot.positionMs, 4321); assert.equal(slot.track.script.id, sha('a'));
  assert.equal(s.speechSlots(epoch + first + 1).length, 2);
  assert.equal(s.atUtc(epoch + first + 90000).kind, 'music');
  const long = s.speechSlots(epoch + 2 * 86400000)[0];
  assert.equal(long.script, null, 'news older than 24 hours is never replayed');
});

test('edition updates preserve music phase and the started dialogue; rollbacks and mutation are rejected', () => {
  const { schedule: s, program, first } = fixture(), time = epoch + first + 2000;
  const old = s.atUtc(time).track;
  const next = structuredClone(program), activation = epoch + first + 90000 + s.tracks[1].durationMs;
  next.banks.push({ id: sha('2'), effectiveAtUtc: iso(activation), dialogues: [dialogue('b')] });
  s.update(next); assert.deepEqual(s.atUtc(time).track, old);
  assert.equal(s.atUtc(activation).track.script.id, sha('b'));
  assert.equal(s.atUtc(activation + 90000).positionMs, 0);
  assert.throws(() => s.update(program), /rollback/);
  const changed = structuredClone(next); changed.banks[0].dialogues = [];
  assert.throws(() => s.update(changed), /changed in place/);
  const grid = structuredClone(next); grid.startIndex = 1;
  assert.throws(() => s.update(grid));
});

test('unsafe phonemes, activation offsets, expired lifetimes and external sources are rejected', () => {
  for (const mutate of [p => p.banks[0].effectiveAtUtc = iso(epoch + 1), p => p.banks[0].dialogues[0].turns[0].chunks[0].tokens = [-1, 2],
    p => p.banks[0].dialogues[0].sourceHref = 'https://example.org/', p => p.banks[0].dialogues[0].expiresAt = iso(epoch + 10)]) {
    const { program } = fixture(); mutate(program); assert.throws(() => createLiveRadioSchedule(music).update(program));
  }
  const { schedule, program } = fixture(), previous = structuredClone(schedule.program);
  program.banks[0].dialogues[0].turns[0].chunks[0].tokens[0] = 200;
  assert.throws(() => schedule.update(program), /token/);
  assert.deepEqual(schedule.program, previous, 'invalid vocabulary must not replace the last usable program');
});

function engineFixture() {
  const messages = [], revoked = [], timers = new Set(); let instance, urls = 0, statuses = [];
  const engine = createSpeechEngine({ runtime, resolveUrl: s => s, workerFactory: () => (instance = { postMessage: m => messages.push(m), terminate() { this.terminated = true; } }),
    createUrl: () => `blob:${++urls}`, revokeUrl: u => revoked.push(u), onStatus: s => statuses.push(s),
    setTimer: fn => { timers.add(fn); return fn; }, clearTimer: fn => timers.delete(fn) });
  return { engine, messages, revoked, timers, get worker() { return instance; }, get statuses() { return statuses; },
    send: data => instance.onmessage({ data }), done() { this.send({ type: 'done', id: messages.at(-1).id, durationMs: 90000, wav: new ArrayBuffer(44) }); } };
}
const speechTrack = id => ({ script: dialogue(id), modelRevision: sha('f') });

test('speech is lazy, serialized, cached at two buffers, and old URLs/workers are released', () => {
  const f = engineFixture(), a = speechTrack('a'), b = speechTrack('b'), c = speechTrack('c');
  assert.equal(f.worker, undefined);
  f.engine.prepare([a, b]); assert.equal(f.messages.length, 1); assert.equal(f.messages[0].type, 'load');
  f.send({ type: 'ready' }); assert.equal(f.messages.at(-1).script.id, a.script.id);
  f.done(); assert.equal(f.engine.urlFor(a), 'blob:1'); assert.equal(f.messages.at(-1).script.id, b.script.id);
  f.done(); f.engine.prepare([b, c]); assert.deepEqual(f.revoked, ['blob:1']); assert.equal(f.engine.urlFor(a), null);
  f.done(); f.engine.dispose(); assert.equal(f.worker.terminated, true); assert.equal(f.timers.size, 0);
  assert.deepEqual(f.revoked.sort(), ['blob:1', 'blob:2', 'blob:3']);
});

test('obsolete results are discarded and timeout/error ends inference without an automatic retry loop', () => {
  const f = engineFixture(), a = speechTrack('a'), b = speechTrack('b');
  f.engine.prepare([a]); f.send({ type: 'ready' }); f.engine.prepare([b]); f.done();
  assert.equal(f.engine.urlFor(a), null); assert.equal(f.messages.at(-1).script.id, b.script.id);
  [...f.timers][0](); assert.equal(f.worker.terminated, true);
  const count = f.messages.length; f.engine.prepare([a]); assert.equal(f.messages.length, count);
  assert.equal(f.statuses.at(-1).phase, 'error'); f.engine.dispose();
});

test('metallic A/B effects preserve timing and finite gain; WAV is a complete 90-second UTC window', () => {
  const input = Float32Array.from({ length: 24000 }, (_, i) => .15 * Math.sin(i * .1));
  const a = metallicVoice(input, 'A'), b = metallicVoice(input, 'B');
  assert.equal(a.length, input.length); assert.equal(b.length, input.length); assert.notDeepEqual(a, b);
  assert.ok(a.every(v => Number.isFinite(v) && Math.abs(v) <= .9));
  const { wav, durationMs, speechSeconds } = buildDialogueWave([{ voice: 'A', audio: input }, { voice: 'B', audio: input }]);
  assert.equal(durationMs, 90000); assert.equal(wav.byteLength, 44 + 90 * 24000 * 2); assert.ok(speechSeconds < 4);
  const view = new DataView(wav); assert.equal(view.getUint32(24, true), 24000);
  assert.throws(() => buildDialogueWave([{ voice: 'A', audio: new Float32Array(89 * 24000) }]), RangeError);
  assert.throws(() => metallicVoice(Float32Array.of(NaN), 'A'));
});
