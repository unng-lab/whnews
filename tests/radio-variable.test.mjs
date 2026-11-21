import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRadioSchedule, createLiveRadioSchedule, dialogueSamples } from '../utils/radio-program.mjs';
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
test('a mixed bank airs its selected discussion once, then rotates general scripts', () => {
  const extended = { ...music, tracks: Array.from({ length: 7 }, (_, i) =>
    ({ id: String(i), title: String(i), src: `/radio/tracks/${i}.mp3`, durationMs: 240000 })) };
  const schedule = createLiveRadioSchedule(extended), first = schedule.tracks[0];
  const { program } = fixture();
  program.legacyProgram.banks[0].effectiveAtUtc = iso(epoch + first.durationMs);
  const bank = program.banks[0];
  bank.stationDialogues = ['b', 'c', 'd', 'e', 'f', '9'].map(id => script(id, true));
  bank.stationDialogue = bank.stationDialogues[0];
  assert.throws(() => schedule.update(program), /requires radio program v4/);
  program.schemaVersion = 4;
  assert.doesNotThrow(() => schedule.update(program));
  const newsAt = epoch + first.durationMs;
  assert.equal(schedule.atUtc(newsAt).track.script.storyId, 'rt-a');
  let cursor = newsAt + bank.dialogues[0].durationMs;
  for (let i = 0; i < 15; i++) {
    const expected = bank.stationDialogues[i % bank.stationDialogues.length];
    const slot = schedule.atUtc(cursor);
    assert.equal(slot.kind, 'music');
    assert.equal(slot.positionMs, 0);
    assert.equal(slot.nextTrack.script.id, expected.id);
    assert.equal(slot.nextTrack.sourceHref, null);
    cursor += slot.track.durationMs + expected.durationMs;
  }
  assert.equal(schedule.speechSlots(epoch + 2 * 86400000)[0].script.kind, 'station');
  const insufficient = structuredClone(program);
  insufficient.banks[0].stationDialogues.length = 1;
  assert.throws(() => schedule.update(insufficient), /twenty minutes/);
  const quiet = structuredClone(program);
  quiet.banks[0].dialogues = [];
  const generalSchedule = createLiveRadioSchedule(extended);
  generalSchedule.update(quiet);
  assert.equal(generalSchedule.atUtc(newsAt).track.script.id, bank.stationDialogue.id);
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
test('appending songs preserves the published conversation and next full song', () => {
  const { s: old, program: oldProgram, first } = fixture();
  const pendingAt = epoch + first + script('a').durationMs;
  const pendingTrack = old.atUtc(pendingAt).track;
  oldProgram.banks.push({ ...oldProgram.banks[0], id: sha('2'), effectiveAtUtc: iso(pendingAt), startIndex: 1 });
  old.update(oldProgram);
  const boundary = pendingAt + pendingTrack.durationMs + script('a').durationMs;
  const track = old.atUtc(boundary).track;
  const expanded = { ...music, programCatalogId: 'expanded', tracks: [...music.tracks,
    { id: 'c', title: 'Music C', src: '/radio/tracks/c.mp3', durationMs: 30000 },
  ] };
  const listener = createLiveRadioSchedule(expanded);
  const index = listener.tracks.findIndex(t => t.id === track.id);
  const next = structuredClone(oldProgram);
  next.banks = next.banks.slice(0, 1);
  next.catalogId = expanded.programCatalogId;
  next.catalog = expanded;
  next.previousEdition = { music, program: oldProgram };
  next.transitionAtUtc = iso(boundary);
  next.legacyProgram.epochUtc = iso(boundary);
  next.legacyProgram.startIndex = index;
  next.legacyProgram.banks[0].effectiveAtUtc = iso(boundary + track.durationMs);
  next.banks[0].effectiveAtUtc = iso(boundary);
  next.banks[0].startIndex = index;
  assert.throws(() => listener.update(oldProgram), /catalog differs/);
  const missing = structuredClone(next);
  delete missing.previousEdition;
  assert.throws(() => listener.update(missing), /Missing previous radio edition/);
  const nested = structuredClone(next);
  nested.previousEdition.program.previousEdition = next.previousEdition;
  assert.throws(() => listener.update(nested), /Incompatible previous radio edition/);
  const badCutover = structuredClone(next);
  badCutover.banks[0].effectiveAtUtc = next.transitionAtUtc.replace('Z', '0Z');
  badCutover.banks[0].startIndex = (index + 1) % expanded.tracks.length;
  assert.throws(() => listener.update(badCutover), /Migration must preserve the next full song/);
  badCutover.banks[0].effectiveAtUtc = iso(boundary + 1000);
  assert.throws(() => listener.update(badCutover), /Catalog must begin at the published transition/);
  listener.update(next);
  assert.deepEqual(listener.atUtc(boundary - 1), old.atUtc(boundary - 1));
  assert.deepEqual(listener.speechSlots(boundary - 1), old.speechSlots(boundary - 1));
  assert.equal(listener.atUtc(boundary).track.id, track.id);
  assert.equal(listener.atUtc(boundary).positionMs, 0);
  assert.equal(listener.atUtc(boundary + track.durationMs).kind, 'dialogue');

  const openTab = createCatalogRadioSchedule(music, () => pendingAt - 1);
  openTab.update(oldProgram);
  const changedPrefix = structuredClone(next);
  changedPrefix.catalog.tracks[0].src = '/radio/tracks/another.mp3';
  assert.throws(() => openTab.update(changedPrefix), /Incompatible radio catalog update/);
  assert.deepEqual(openTab.music, music);
  const changedDialogue = structuredClone(next);
  changedDialogue.previousEdition.program.banks[0].dialogues[0].id = sha('e');
  assert.throws(() => openTab.update(changedDialogue), /Radio bank changed in place/);
  const reformatted = structuredClone(changedDialogue);
  reformatted.previousEdition.program.banks[0].effectiveAtUtc = iso(epoch).replace('Z', '0Z');
  assert.throws(() => openTab.update(reformatted), /Radio bank changed in place/);
  const omitted = structuredClone(next);
  omitted.previousEdition.program.banks.shift();
  assert.throws(() => openTab.update(omitted), /changes a current or scheduled edition/);
  assert.deepEqual(openTab.atUtc(boundary - 1), old.atUtc(boundary - 1));
  const laterTab = createCatalogRadioSchedule(music, () => pendingAt + 1);
  laterTab.update(oldProgram);
  laterTab.update(omitted);
  assert.deepEqual(laterTab.atUtc(pendingAt + 1), old.atUtc(pendingAt + 1));
  openTab.update(next);
  assert.deepEqual(openTab.music, expanded);
  for (const t of [boundary - 1, boundary, boundary + track.durationMs + 5000]) {
    assert.deepEqual(openTab.atUtc(t), listener.atUtc(t));
    assert.deepEqual(openTab.speechSlots(t), listener.speechSlots(t));
  }
  assert.throws(() => openTab.update(oldProgram), /Radio catalog differs/);
  assert.deepEqual(openTab.music, expanded);

  const broken = structuredClone(next);
  broken.transitionAtUtc = broken.legacyProgram.epochUtc = broken.banks[0].effectiveAtUtc = iso(boundary + 1);
  broken.legacyProgram.banks[0].effectiveAtUtc = iso(boundary + track.durationMs + 1);
  assert.throws(() => listener.update(broken), /preserve the next full song/);
  assert.deepEqual(listener.program, next);
});
test('variable WAV ends within 80ms of the final turn, with no 90-second padding', () => {
  const turns = Array.from({ length: 7 }, (_, i) => ({ voice: i % 2 ? 'B' : 'A', audio: Float32Array.from({ length: 24064 }, (_, n) => .1 * Math.sin(n / 10)) }));
  const count = dialogueSamples(script('a').turns), result = buildDialogueWave(turns, 24000, count);
  assert.equal(result.wav.byteLength, 44 + count * 2); assert.equal(result.durationMs, Math.ceil(count / 24));
  assert.ok(result.durationMs < 10000); assert.equal(count - 2400 - turns.reduce((n,t) => n+t.audio.length, 0) - 5760 * 6, 1920);
});
