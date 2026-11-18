import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRadioSchedule, radioAudioUrl, radioTime } from '../utils/radio-schedule.mjs';
import { createRadioPlayer } from '../utils/radio-player.mjs';

const edition = () => ({ schemaVersion: 1, epochUtc: '2026-11-17T00:00:00Z', shuffleSeed: 'fixed', tracks: [
  { id: 'a', title: 'Первая', durationMs: 10000, src: '/radio/tracks/a.mp3' },
  { id: 'b', title: 'Вторая', durationMs: 20000, src: '/radio/tracks/b.mp3' },
  { id: 'c', title: 'Третья', durationMs: 30000, src: '/radio/tracks/c.mp3' },
] });
const flush = () => new Promise(resolve => setImmediate(resolve));

class FakeAudio {
  constructor() {
    this.listeners = new Map(); this.src = ''; this.paused = true; this.ended = false;
    this.readyState = 0; this.duration = 60; this.position = 0; this.seeks = 0; this.loads = 0; this.plays = [];
  }
  get currentTime() { return this.position; }
  set currentTime(value) { this.position = value; this.seeks++; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name) { this.listeners.delete(name); }
  event(name) { this.listeners.get(name)?.(); }
  load() { this.loads++; this.readyState = 0; this.ended = false; }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  play() {
    return new Promise((resolve, reject) => this.plays.push({ resolve: () => { this.paused = false; resolve(); }, reject }));
  }
}
function playerFixture() {
  const schedule = createRadioSchedule(edition()), audio = new FakeAudio();
  let time = schedule.epochMs + 4321, state;
  const player = createRadioPlayer({ audio, schedule, now: () => time, onChange: next => { state = next; } });
  player.tick();
  return { schedule, audio, player, get state() { return state; }, setTime: value => { time = value; } };
}

test('fixed shuffle and UTC position are independent of input ordering and repeat exactly', () => {
  const manifest = edition(), a = createRadioSchedule(manifest);
  manifest.tracks.reverse();
  const b = createRadioSchedule(manifest);
  assert.deepEqual(a.tracks, b.tracks);
  assert.equal(new Set(a.tracks.map(t => t.id)).size, 3);
  for (const offset of [0, 9999, 10000, 59999, 60000, -1, -60000, 123456789]) {
    assert.deepEqual(a.atUtc(a.epochMs + offset), b.atUtc(b.epochMs + offset));
    assert.deepEqual(a.atUtc(a.epochMs + offset), a.atUtc(a.epochMs + offset + a.totalMs));
  }
});

test('track boundaries are half-open, including cycle and pre-epoch wrap', () => {
  const s = createRadioSchedule(edition());
  let cursor = s.epochMs;
  for (const track of s.tracks) {
    assert.equal(s.atUtc(cursor).track.id, track.id);
    assert.equal(s.atUtc(cursor).positionMs, 0);
    assert.equal(s.atUtc(cursor + track.durationMs - 1).track.id, track.id);
    cursor += track.durationMs;
  }
  assert.equal(s.atUtc(cursor).track.id, s.tracks[0].id);
  assert.equal(s.atUtc(s.epochMs - 1).positionMs, s.tracks.at(-1).durationMs - 1);
});

test('empty/unsafe editions, duplicate IDs and invalid durations fail early', () => {
  for (const mutate of [m => m.tracks = [], m => m.tracks[0].durationMs = 0,
    m => m.tracks[0].src = '/radio/tracks/../secret.mp3', m => m.tracks.push(m.tracks[0]),
    m => m.epochUtc = '2026-11-17T00:00:00']) {
    const m = edition(); mutate(m); assert.throws(() => createRadioSchedule(m));
  }
  const s = createRadioSchedule(edition());
  assert.throws(() => s.atUtc(NaN));
  assert.equal(radioAudioUrl('/whnews/', '/radio/tracks/a.mp3'), '/whnews/radio/tracks/a.mp3');
  assert.equal(radioAudioUrl('/', '/radio/tracks/a.mp3'), '/radio/tracks/a.mp3');
  assert.equal(radioTime(165999), '2:45');
});

test('mounting never downloads audio; user start seeks to current UTC after metadata', async () => {
  const f = playerFixture();
  assert.equal(f.audio.src, ''); assert.equal(f.audio.loads, 0); assert.equal(f.audio.plays.length, 0);
  f.player.start();
  assert.equal(f.audio.plays.length, 1);
  f.setTime(f.schedule.epochMs + 6500);
  f.audio.readyState = 1; f.audio.event('loadedmetadata');
  assert.equal(f.audio.currentTime, 6.5);
  const seeks = f.audio.seeks;
  f.audio.event('canplay'); assert.equal(f.audio.seeks, seeks, 'canplay must not trigger a seeking loop');
  f.audio.plays[0].resolve(); await flush();
  assert.equal(f.state.playing, true);
});

test('UTC tick corrects buffering drift, changes tracks and catches clock jumps', () => {
  const f = playerFixture(); f.player.start(); f.audio.readyState = 1;
  f.audio.currentTime = 0; f.player.tick(); assert.equal(f.audio.currentTime, 4.321);
  const nextStart = f.schedule.epochMs + f.schedule.tracks[0].durationMs;
  f.setTime(nextStart + 2000); f.player.tick();
  assert.equal(f.audio.src, f.schedule.tracks[1].src);
  f.audio.readyState = 1; f.audio.event('loadedmetadata'); assert.equal(f.audio.currentTime, 2);
  f.setTime(f.schedule.epochMs + f.schedule.totalMs * 12 + 7000); f.player.tick(true);
  assert.equal(f.audio.src, f.schedule.tracks[0].src);
  f.audio.readyState = 1; f.audio.event('loadedmetadata'); assert.equal(f.audio.currentTime, 7);
});

test('stopping cancels loading and old play rejection cannot stop a new session', async () => {
  const f = playerFixture(); f.player.start(); const stale = f.audio.plays[0];
  f.player.stop(); assert.equal(f.audio.src, ''); assert.equal(f.state.wanted, false);
  f.setTime(f.schedule.epochMs + 8000); f.player.start();
  stale.reject(new Error('aborted old load')); await flush();
  assert.equal(f.state.wanted, true); assert.equal(f.state.error, '');
  f.audio.readyState = 1; f.audio.event('loadedmetadata'); assert.equal(f.audio.currentTime, 8);
});

test('media errors stop retry loops; explicit retry reconnects to live UTC', () => {
  const f = playerFixture(); f.player.start(); f.audio.event('error');
  assert.equal(f.state.wanted, false); assert.ok(f.state.error);
  const loads = f.audio.loads; f.player.tick(); assert.equal(f.audio.loads, loads);
  f.setTime(f.schedule.epochMs + 9000); f.player.start();
  f.audio.readyState = 1; f.audio.event('loadedmetadata');
  assert.equal(f.audio.currentTime, 9); assert.equal(f.state.error, '');
  f.player.dispose(); assert.equal(f.audio.listeners.size, 0); assert.equal(f.audio.src, '');
});

test('a precise UTC boundary timer starts the next track and Stop cancels it', () => {
  const schedule = createRadioSchedule(edition()), audio = new FakeAudio(), timers = new Map();
  let clock = schedule.epochMs + schedule.tracks[0].durationMs - 100, serial = 0;
  const player = createRadioPlayer({ audio, schedule, now: () => clock,
    setTimer: (fn, delay) => { timers.set(++serial, { fn, delay }); return serial; }, clearTimer: id => timers.delete(id) });
  player.start(); assert.equal([...timers.values()][0].delay, 100);
  const callback = [...timers.values()][0].fn;
  clock += 100; callback();
  assert.equal(audio.src, schedule.tracks[1].src);
  player.stop(); assert.equal(timers.size, 0); player.dispose();
});

test('published music points to ordered S3 objects and retains the old MP3 files', () => {
  const manifest = JSON.parse(readFileSync(new URL('../content/radio.json', import.meta.url), 'utf8'));
  const schedule = createRadioSchedule(manifest);
  assert.equal(schedule.tracks.length, 350);
  for (const [index, track] of manifest.tracks.entries()) {
    const number = String(index + 1).padStart(3, '0');
    assert.equal(track.id, `xl-${number}`);
    assert.equal(track.src, `https://whnews-radio.s3.cloud.ru/radio/xl-v1/${number}.mp3`);
    assert.match(track.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(track.bytes) && track.bytes > 0);
  }
  assert.equal(new Set(manifest.tracks.map(track => track.sha256)).size, 350);
  const oldAudio = readdirSync(new URL('../public/radio/tracks/', import.meta.url));
  assert.equal(oldAudio.filter(file => file.endsWith('.mp3')).length, 103);
});

test('only the station S3 prefix is accepted for remote music', () => {
  const manifest = JSON.parse(readFileSync(new URL('../content/radio.json', import.meta.url), 'utf8'));
  const track = { ...manifest.tracks[0] };
  const src = 'https://whnews-radio.s3.cloud.ru/radio/xl-v1/001.mp3';
  const edition = { ...manifest, tracks: [{ ...track, src }] };
  assert.equal(createRadioSchedule(edition).tracks[0].src, src);
  assert.equal(radioAudioUrl('/whnews/', src), src);
  for (const invalid of [
    src.replace('https:', 'http:'),
    src.replace('s3.cloud.ru', 's3.cloud.ru.example.com'),
    src.replace('xl-v1/001', 'xl-v1/../001'),
    src + '?signature=temporary',
  ]) assert.throws(() => createRadioSchedule({ ...edition, tracks: [{ ...track, src: invalid }] }));
});
