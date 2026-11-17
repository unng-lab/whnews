import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveRadioSchedule, dialogueSamples } from '../utils/radio-program.mjs';
import { buildDialogueWave } from '../utils/radio-dsp.mjs';
const sha = n => n.repeat(64), epoch = Date.parse('2026-11-17T00:00:00Z'), iso = ms => new Date(ms).toISOString();
const music = { schemaVersion: 1, epochUtc: iso(epoch), shuffleSeed: 'fixed', tracks: [
  { id: 'a', title: 'Music A', src: '/radio/tracks/a.mp3', durationMs: 10000 },
  { id: 'b', title: 'Music B', src: '/radio/tracks/b.mp3', durationMs: 20000 },
] };
function script(id, station = false) {
  const turns = Array.from({ length: 7 }, (_, i) => ({ voice: i % 2 ? 'B' : 'A', text: 'Сейчас музыка.', chunks: [{ tokens: [1, 2], stress: [0, 1], sampleCount: 24064 }] }));
  const count = dialogueSamples(turns);
  return { id: sha(id), title: 'Вокс-вахта', turns, sampleCount: count, durationMs: Math.ceil(count / 24),
    ...(station ? { kind: 'station', sourceHref: null } : { storyId: 'rt-a', publishedAt: iso(epoch), expiresAt: iso(epoch + 86400000), sourceHref: '/news/rt-a/' }) };
}
function fixture(empty = false) {
  const s = createLiveRadioSchedule(music), first = s.tracks[0].durationMs;
  const legacyProgram = { schemaVersion: 2, stationId: 'test', epochUtc: iso(epoch), startIndex: 0, speechWindowMs: 90000,
    modelRevision: sha('f'), fallbackSrc: '/radio/interlude-abc.mp3', banks: [{ id: sha('0'), effectiveAtUtc: iso(epoch + first), dialogues: [] }] };
  const program = { schemaVersion: 3, modelRevision: sha('f'), fallbackSrc: legacyProgram.fallbackSrc, transitionAtUtc: iso(epoch), legacyProgram,
    banks: [{ id: sha('1'), effectiveAtUtc: iso(epoch), startIndex: 0, dialogues: empty ? [] : [script('a')], stationDialogue: script('b', true) }] };
  s.update(program); return { s, program, first };
}
test('a measured conversation ends directly at the next full song, identically for two listeners', () => {
  const { s, program, first } = fixture(), second = createLiveRadioSchedule(music); second.update(program);
  const voice = s.atUtc(epoch + first), end = voice.startMs + voice.track.durationMs;
  assert.ok(voice.track.durationMs < 90000); assert.equal(voice.track.script.turns.at(-1).voice, 'A');
  assert.equal(s.atUtc(end - 1).kind, 'dialogue');
  assert.equal(s.atUtc(end).kind, 'music'); assert.equal(s.atUtc(end).positionMs, 0);
  for (const t of [epoch - 1, epoch, end, end + 5000000, epoch + 2 * 86400000]) assert.deepEqual(s.atUtc(t), second.atUtc(t));
});
test('quiet news and stale news use a complete general conversation, never a padded short script', () => {
  for (const empty of [false, true]) {
    const { s } = fixture(empty);
    const slots = s.speechSlots(epoch + 2 * 86400000);
    assert.equal(slots[0].script.kind, 'station'); assert.equal(slots[0].sourceHref, null);
    assert.equal(slots[0].durationMs, slots[0].script.durationMs);
  }
});
test('future banks activate at song boundaries without interrupting a conversation', () => {
  const { s, program, first } = fixture(), end = epoch + first + script('a').durationMs;
  const next = structuredClone(program);
  next.banks.push({ ...structuredClone(next.banks[0]), id: sha('2'), effectiveAtUtc: iso(end), startIndex: 1, dialogues: [] });
  s.update(next); assert.equal(s.atUtc(end - 1).kind, 'dialogue'); assert.equal(s.atUtc(end).kind, 'music');
  const invalid = structuredClone(next); invalid.banks[1].effectiveAtUtc = iso(end - 1);
  assert.throws(() => s.update(invalid));
  const bad = structuredClone(next); bad.banks[1].stationDialogue.turns[0].chunks[0].tokens[0] = 200;
  assert.throws(() => s.update(bad)); assert.deepEqual(s.program, next);
});
test('variable WAV ends within 80ms of the final turn, with no 90-second padding', () => {
  const turns = Array.from({ length: 7 }, (_, i) => ({ voice: i % 2 ? 'B' : 'A', audio: Float32Array.from({ length: 24064 }, (_, n) => .1 * Math.sin(n / 10)) }));
  const count = dialogueSamples(script('a').turns), result = buildDialogueWave(turns, 24000, count);
  assert.equal(result.wav.byteLength, 44 + count * 2); assert.equal(result.durationMs, Math.ceil(count / 24));
  assert.ok(result.durationMs < 10000); assert.equal(count - 2400 - turns.reduce((n,t) => n+t.audio.length, 0) - 5760 * 6, 1920);
});
