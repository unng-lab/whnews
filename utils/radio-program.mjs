import { createRadioSchedule } from './radio-schedule.mjs';
import voiceConfig from '../public/radio/voice/config-39f1af520ca4.json' with { type: 'json' };

const WINDOW = 90000, DAY = 86400000;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = value => typeof value === 'string' && value.endsWith('Z') && Number.isSafeInteger(Date.parse(value));
const plain = value => typeof value === 'string' && value.trim() && value.length <= 700 && !/[<>\x00-\x1f]/.test(value);
const requireValue = (value, message) => { if (!value) throw new TypeError(message); };

function validateDialogue(dialogue) {
  requireValue(dialogue && hash(dialogue.id) && /^[a-z0-9-]{1,100}$/.test(dialogue.storyId), 'Invalid dialogue identity');
  requireValue(plain(dialogue.title) && timestamp(dialogue.publishedAt) && timestamp(dialogue.expiresAt) &&
    Date.parse(dialogue.expiresAt) - Date.parse(dialogue.publishedAt) === DAY &&
    dialogue.sourceHref === `/news/${dialogue.storyId}/`, 'Invalid dialogue source');
  requireValue(Array.isArray(dialogue.turns) && dialogue.turns.length >= 6 && dialogue.turns.length <= 10, 'Invalid turns');
  let total = 0;
  for (const [index, turn] of dialogue.turns.entries()) {
    requireValue(turn?.voice === (index % 2 ? 'B' : 'A') && plain(turn.text) && Array.isArray(turn.chunks) && turn.chunks.length >= 1 && turn.chunks.length <= 3, 'Invalid voice/text');
    for (const chunk of turn.chunks) {
      requireValue(Array.isArray(chunk.tokens) && Array.isArray(chunk.stress) && chunk.tokens.length >= 2 && chunk.tokens.length <= 500 && chunk.tokens.length === chunk.stress.length, 'Invalid phonemes');
      requireValue(chunk.tokens.every(v => Number.isInteger(v) && v >= 0 && v < voiceConfig.symbols.length) && chunk.stress.every(v => Number.isInteger(v) && v >= 0 && v <= 2), 'Invalid token/stress values');
      total += chunk.tokens.length;
    }
  }
  requireValue(total <= 2500, 'Dialogue token budget exceeded');
}

export function validateRadioProgram(program, music) {
  const legacy = createRadioSchedule(music);
  requireValue(program?.schemaVersion === 2 && timestamp(program.epochUtc) && hash(program.modelRevision) &&
    program.speechWindowMs === WINDOW && Number.isInteger(program.startIndex) && program.startIndex >= 0 &&
    program.startIndex < legacy.tracks.length && typeof program.stationId === 'string' && program.stationId.length <= 80 &&
    /^\/radio\/interlude-[a-f0-9]+\.mp3$/.test(program.fallbackSrc), 'Invalid radio program');
  requireValue(Array.isArray(program.banks) && program.banks.length >= 1 && program.banks.length <= 18, 'Invalid banks');
  const tracks = legacy.tracks.slice(program.startIndex).concat(legacy.tracks.slice(0, program.startIndex));
  const total = tracks.reduce((sum, track) => sum + track.durationMs + WINDOW, 0);
  const speechOffsets = [];
  let cursor = 0;
  for (const track of tracks) { speechOffsets.push(cursor + track.durationMs); cursor += track.durationMs + WINDOW; }
  let lastTime = -Infinity;
  for (const bank of program.banks) {
    const at = Date.parse(bank?.effectiveAtUtc);
    requireValue(hash(bank?.id) && timestamp(bank.effectiveAtUtc) && at > lastTime && at >= Date.parse(program.epochUtc) &&
      speechOffsets.includes((at - Date.parse(program.epochUtc)) % total), 'Invalid bank activation');
    requireValue(Array.isArray(bank.dialogues) && bank.dialogues.length <= 12, 'Invalid bank size');
    const ids = new Set();
    for (const dialogue of bank.dialogues) { validateDialogue(dialogue); requireValue(!ids.has(dialogue.storyId), 'Duplicate news dialogue'); ids.add(dialogue.storyId); }
    lastTime = at;
  }
  return program;
}

export function createLiveRadioSchedule(music) {
  const legacy = createRadioSchedule(music);
  let program = null, grid = null, held = null;
  function update(next) {
    validateRadioProgram(next, music);
    if (program && ['epochUtc', 'startIndex', 'speechWindowMs', 'modelRevision', 'stationId', 'fallbackSrc'].some(k => program[k] !== next[k])) throw new TypeError('Radio grid is immutable');
    if (program) {
      const latest = program.banks.at(-1), incoming = next.banks.at(-1);
      if (Date.parse(incoming.effectiveAtUtc) < Date.parse(latest.effectiveAtUtc)) throw new TypeError('Radio bank rollback');
      for (const bank of next.banks) {
        const known = program.banks.find(b => b.effectiveAtUtc === bank.effectiveAtUtc);
        if (known && JSON.stringify(known) !== JSON.stringify(bank)) throw new TypeError('Radio bank changed in place');
      }
    }
    program = structuredClone(next);
    const tracks = legacy.tracks.slice(program.startIndex).concat(legacy.tracks.slice(0, program.startIndex));
    let totalMs = 0;
    grid = { epochMs: Date.parse(program.epochUtc), tracks, starts: tracks.map(track => { const start = totalMs; totalMs += track.durationMs + WINDOW; return start; }), totalMs };
  }
  function speech(trackIndex, cycle) {
    const startMs = grid.epochMs + cycle * grid.totalMs + grid.starts[trackIndex] + grid.tracks[trackIndex].durationMs;
    const bank = [...program.banks].reverse().find(b => Date.parse(b.effectiveAtUtc) <= startMs);
    const available = (bank?.dialogues ?? []).filter(d => Date.parse(d.publishedAt) <= startMs && Date.parse(d.expiresAt) > startMs);
    const ordinal = cycle * grid.tracks.length + trackIndex;
    const script = available.length ? available[((ordinal % available.length) + available.length) % available.length] : null;
    return { id: `speech-${startMs}-${script?.id ?? 'interlude'}`, kind: 'dialogue', title: script?.title ?? 'Музыкальная интерлюдия',
      genre: script ? 'Разговор ведущих А и Б' : 'Варп-эфир', durationMs: WINDOW, src: program.fallbackSrc,
      sourceHref: script?.sourceHref ?? null, script, modelRevision: program.modelRevision, startMs };
  }
  function rawSlot(now) {
    if (!Number.isSafeInteger(now)) throw new RangeError('Invalid radio time');
    if (!grid || now < grid.epochMs) return { ...legacy.atUtc(now), kind: 'music', startMs: now - legacy.atUtc(now).positionMs };
    const cycle = Math.floor((now - grid.epochMs) / grid.totalMs);
    const offset = (now - grid.epochMs) % grid.totalMs;
    let index = grid.starts.length - 1;
    while (index > 0 && grid.starts[index] > offset) index--;
    const track = grid.tracks[index], local = offset - grid.starts[index];
    if (local < track.durationMs) return { kind: 'music', track: { ...track, kind: 'music' }, nextTrack: speech(index, cycle), index,
      positionMs: local, remainingMs: track.durationMs - local, startMs: grid.epochMs + cycle * grid.totalMs + grid.starts[index] };
    const voice = speech(index, cycle);
    return { kind: 'dialogue', track: voice, nextTrack: grid.tracks[(index + 1) % grid.tracks.length], index,
      positionMs: local - track.durationMs, remainingMs: WINDOW - (local - track.durationMs), startMs: voice.startMs };
  }
  function atUtc(now) {
    const slot = rawSlot(now);
    if (slot.kind === 'dialogue') {
      if (held?.startMs === slot.startMs) slot.track = held;
      else held = slot.track;
    } else held = null;
    return slot;
  }
  function speechSlots(now) {
    if (!grid || now < grid.epochMs) return [];
    const current = atUtc(now);
    if (current.kind === 'music') return [current.nextTrack];
    const following = rawSlot(current.startMs + WINDOW + 1);
    return [current.track, following.nextTrack];
  }
  return { ...legacy, update, atUtc, speechSlots, get program() { return program; } };
}

export async function fetchRadioProgram(url, { signal } = {}) {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok || Number(response.headers.get('Content-Length') || 0) > 6 * 1024 * 1024) throw new Error('Radio plan unavailable');
  const text = await response.text();
  if (text.length > 6 * 1024 * 1024) throw new Error('Radio plan too large');
  return JSON.parse(text);
}
