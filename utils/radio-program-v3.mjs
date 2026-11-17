import { createRadioSchedule } from './radio-schedule.mjs';
import hosts from '../content/radio-hosts.json' with { type: 'json' };
import { createLiveRadioSchedule as createV2, validateRadioProgram as validateV2, fetchRadioProgram } from './radio-program-v2.mjs';
export { fetchRadioProgram };
const valid = (v, message) => { if (!v) throw new TypeError(message); };
const time = value => typeof value === 'string' && value.endsWith('Z') && Number.isSafeInteger(Date.parse(value));
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function dialogueSamples(turns) {
  return 4320 + turns.reduce((n, turn) => n + turn.chunks.reduce((m, c) => m + c.sampleCount, 0) + 1920 * (turn.chunks.length - 1), 0) + 5760 * (turns.length - 1);
}
function gridFor(bank, ordered) {
  const tracks = ordered.slice(bank.startIndex).concat(ordered.slice(0, bank.startIndex));
  let totalMs = 0;
  const slots = tracks.map((track, index) => {
    const script = bank.dialogues.length ? bank.dialogues[index % bank.dialogues.length] : bank.stationDialogue;
    const start = totalMs, voiceMs = script.durationMs;
    totalMs += track.durationMs + voiceMs;
    return { track, script, start, voiceMs };
  });
  return { slots, totalMs, epoch: Date.parse(bank.effectiveAtUtc) };
}
function activeGrid(bank, ordered, now) {
  const grid = gridFor(bank, ordered);
  if (!bank.dialogues.length) return grid;
  const expiry = Math.min(...bank.dialogues.map(d => Date.parse(d.expiresAt)));
  let cycle = Math.max(0, Math.floor((expiry - grid.epoch) / grid.totalMs) - 1);
  for (;; cycle++) for (const slot of grid.slots) {
    const start = grid.epoch + cycle * grid.totalMs + slot.start;
    if (start + slot.track.durationMs >= expiry) {
      return now < start ? grid : gridFor({ ...bank, dialogues: [], effectiveAtUtc: new Date(start).toISOString(), startIndex: ordered.findIndex(t => t.id === slot.track.id) }, ordered);
    }
  }
}
function validateTiming(d) {
  valid([7, 9].includes(d.turns.length) && d.turns.at(-1).voice === 'A', 'Announcer must close the conversation');
  for (const [i, turn] of d.turns.entries()) {
    valid(turn.voice === (i % 2 ? 'B' : 'A') && typeof turn.text === 'string' && turn.text.trim() && turn.text.length <= 700 && !/[<>\x00-\x1f]/.test(turn.text) && Array.isArray(turn.chunks) && turn.chunks.length >= 1 && turn.chunks.length <= 3, 'Invalid station turn');
    for (const c of turn.chunks) valid(Number.isInteger(c.sampleCount) && c.sampleCount >= 256 && c.sampleCount <= 32 * 24000 && c.sampleCount % 256 === 0, 'Invalid speech sample count');
  }
  valid(d.sampleCount === dialogueSamples(d.turns) && d.durationMs === Math.ceil(d.sampleCount / 24) && d.durationMs >= 1000 && d.durationMs <= 88000, 'Invalid speech duration');
}
export function validateRadioProgram(program, music) {
  if (program?.schemaVersion === 2) return validateV2(program, music);
  valid(program?.schemaVersion === 3 && time(program.transitionAtUtc) && hash(program.modelRevision) && /^\/radio\/interlude-[a-f0-9]+\.mp3$/.test(program.fallbackSrc), 'Invalid variable radio program');
  validateV2(program.legacyProgram, music);
  valid(program.modelRevision === program.legacyProgram.modelRevision && program.fallbackSrc === program.legacyProgram.fallbackSrc, 'Incompatible radio model');
  valid(Array.isArray(program.banks) && program.banks.length >= 1 && program.banks.length <= 18, 'Invalid editions');
  const ordered = createRadioSchedule(music).tracks;
  let previous = null;
  for (const bank of program.banks) {
    valid(hash(bank.id) && time(bank.effectiveAtUtc) && Number.isInteger(bank.startIndex) && bank.startIndex >= 0 && bank.startIndex < ordered.length && Array.isArray(bank.dialogues) && bank.dialogues.length <= 12, 'Invalid radio edition');
    // The prior contract checks sources, text, inventory, budgets and lifetimes.
    const skeleton = structuredClone(program.legacyProgram);
    const station = bank.stationDialogue;
    valid(station && station.kind === 'station' && hash(station.id) && station.sourceHref === null && typeof station.title === 'string' && station.title.trim() && station.title.length <= 140, 'Missing station dialogue');
    const proxy = { ...station, storyId: 'station-vox', publishedAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z', sourceHref: '/news/station-vox/' };
    skeleton.banks = [{ id: bank.id, effectiveAtUtc: new Date(Date.parse(skeleton.epochUtc) + ordered[skeleton.startIndex].durationMs).toISOString(), dialogues: [...bank.dialogues, proxy].slice(0, 12) }];
    validateV2(skeleton, music);
    // Always validate the station script, including when twelve news scripts exist.
    skeleton.banks[0].dialogues = [proxy]; validateV2(skeleton, music);
    for (const d of [...bank.dialogues, station]) validateTiming(d);
    valid(Date.parse(bank.effectiveAtUtc) >= Date.parse(program.transitionAtUtc), 'Edition before migration');
    if (bank.effectiveAtUtc === program.transitionAtUtc) {
      const old = createV2(music); old.update(program.legacyProgram);
      const slot = old.atUtc(Date.parse(bank.effectiveAtUtc));
      valid(slot.kind === 'music' && slot.positionMs === 0 && slot.track.id === ordered[bank.startIndex].id, 'Migration must preserve the next full song');
    }
    if (previous) {
      const old = activeGrid(previous, ordered, Date.parse(bank.effectiveAtUtc)), delta = Date.parse(bank.effectiveAtUtc) - old.epoch;
      valid(Date.parse(bank.effectiveAtUtc) > Date.parse(previous.effectiveAtUtc) && delta >= 0, 'Radio editions out of order');
      const index = old.slots.findIndex(s => s.start === delta % old.totalMs);
      valid(index >= 0 && ordered[bank.startIndex].id === old.slots[index].track.id, 'Edition must start at the next full song boundary');
    }
    previous = bank;
  }
  return program;
}
export function createLiveRadioSchedule(music) {
  const legacy = createV2(music), ordered = createRadioSchedule(music).tracks;
  let program = null;
  function update(next) {
    validateRadioProgram(next, music);
    if (next.schemaVersion === 2) { valid(!program, 'Radio version rollback'); legacy.update(next); return; }
    if (program) {
      valid(next.transitionAtUtc === program.transitionAtUtc && next.modelRevision === program.modelRevision && next.fallbackSrc === program.fallbackSrc && JSON.stringify(next.legacyProgram) === JSON.stringify(program.legacyProgram), 'Radio base changed');
      valid(Date.parse(next.banks.at(-1).effectiveAtUtc) >= Date.parse(program.banks.at(-1).effectiveAtUtc), 'Radio bank rollback');
      for (const b of next.banks) {
        const old = program.banks.find(p => p.effectiveAtUtc === b.effectiveAtUtc);
        valid(!old || JSON.stringify(old) === JSON.stringify(b), 'Radio bank changed in place');
      }
    }
    legacy.update(next.legacyProgram); program = structuredClone(next);
  }
  function atUtc(now) {
    valid(Number.isSafeInteger(now), 'Invalid radio time');
    const bank = program?.banks.findLast(b => Date.parse(b.effectiveAtUtc) <= now);
    if (!bank) return legacy.atUtc(now);
    const grid = activeGrid(bank, ordered, now), cycle = Math.floor((now - grid.epoch) / grid.totalMs), offset = (now - grid.epoch) % grid.totalMs;
    const index = grid.slots.findLastIndex(s => s.start <= offset), entry = grid.slots[index], local = offset - entry.start;
    const musicStart = grid.epoch + cycle * grid.totalMs + entry.start, voiceStart = musicStart + entry.track.durationMs;
    const script = entry.script;
    const voice = { id: `speech-${voiceStart}-${script.id}`, kind: 'dialogue', title: script.title, genre: `Ведущие: ${hosts.map(host => host.name).join(' и ')}`,
      durationMs: entry.voiceMs, src: program.fallbackSrc, sourceHref: script.sourceHref, script, modelRevision: program.modelRevision, startMs: voiceStart };
    if (local < entry.track.durationMs) return { kind: 'music', track: { ...entry.track, kind: 'music' }, nextTrack: voice,
      positionMs: local, remainingMs: entry.track.durationMs - local, startMs: musicStart, index };
    return { kind: 'dialogue', track: voice, nextTrack: grid.slots[(index + 1) % grid.slots.length].track,
      positionMs: local - entry.track.durationMs, remainingMs: entry.voiceMs - (local - entry.track.durationMs), startMs: voiceStart, index };
  }
  function speechSlots(now) {
    if (!program || now < Date.parse(program.banks[0].effectiveAtUtc)) return legacy.speechSlots(now);
    const current = atUtc(now);
    if (current.kind === 'music') return [current.nextTrack];
    return [current.track, atUtc(current.startMs + current.track.durationMs).nextTrack];
  }
  return { ...legacy, update, atUtc, speechSlots, get program() { return program ?? legacy.program; } };
}
