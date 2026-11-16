// A fixed edition of the station: UTC, half-open track intervals, no random runtime state.
export function stableHash(text) {
  let hash = 2166136261;
  for (const code of new TextEncoder().encode(text)) hash = Math.imul(hash ^ code, 16777619) >>> 0;
  return hash;
}

export function createRadioSchedule(manifest) {
  if (manifest?.schemaVersion !== 1 || typeof manifest.shuffleSeed !== 'string' || !manifest.shuffleSeed ||
      typeof manifest.epochUtc !== 'string' || !manifest.epochUtc.endsWith('Z') || !Number.isFinite(Date.parse(manifest.epochUtc)) ||
      !Array.isArray(manifest.tracks) || !manifest.tracks.length) throw new TypeError('Invalid radio edition');
  const ids = new Set();
  for (const track of manifest.tracks) {
    if (!track || typeof track.id !== 'string' || !track.id || ids.has(track.id) ||
        typeof track.title !== 'string' || !track.title.trim() ||
        !Number.isSafeInteger(track.durationMs) || track.durationMs < 1000 ||
        typeof track.src !== 'string' || !/^\/radio\/tracks\/[a-zA-Z0-9-]+\.mp3$/.test(track.src)) {
      throw new TypeError('Invalid radio track');
    }
    ids.add(track.id);
  }
  const tracks = manifest.tracks.map(track => ({ ...track, rank: stableHash(`${manifest.shuffleSeed}:${track.id}`) }))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const starts = [];
  let totalMs = 0;
  for (const track of tracks) { starts.push(totalMs); totalMs += track.durationMs; }
  if (!Number.isSafeInteger(totalMs)) throw new RangeError('Radio edition is too long');
  const epochMs = Date.parse(manifest.epochUtc);
  function atUtc(nowMs) {
    if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(nowMs - epochMs)) throw new RangeError('Invalid UTC time');
    const cycleMs = ((nowMs - epochMs) % totalMs + totalMs) % totalMs;
    let low = 0, high = tracks.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (starts[middle] <= cycleMs) low = middle; else high = middle;
    }
    return { track: tracks[low], nextTrack: tracks[(low + 1) % tracks.length],
      index: low, positionMs: cycleMs - starts[low], remainingMs: starts[low] + tracks[low].durationMs - cycleMs };
  }
  return { tracks, totalMs, epochMs, atUtc };
}

export function radioAudioUrl(baseURL, src) {
  return `${baseURL.replace(/\/$/, '')}${src}`;
}

export function radioTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
