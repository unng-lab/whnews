export function validateVoiceRuntime(runtime) {
  const asset = entry => entry && /^\/radio\/voice\/[a-zA-Z0-9.-]+$/.test(entry.src) && /^[a-f0-9]{64}$/.test(entry.sha256);
  if (runtime?.schemaVersion !== 1 || runtime.sampleRate !== 24000 || !asset(runtime.model) || !asset(runtime.config) ||
      runtime.ort?.version !== '1.31.1' || runtime.ort.baseUrl !== '/radio/voice/ort-1.31.1/') throw new TypeError('Invalid voice runtime');
  return runtime;
}

export function createSpeechEngine({ runtime, resolveUrl, workerFactory, onStatus = () => {}, onReady = () => {},
  createUrl = wav => URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), revokeUrl = url => URL.revokeObjectURL(url),
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  validateVoiceRuntime(runtime);
  const entries = new Map();
  let worker = null, ready = false, disposed = false, busy = null, serial = 0, timer = null, failed = false;
  const keyFor = track => track?.script ? `${track.modelRevision}:${track.script.id}:effects-1` : null;
  const report = (phase, message = '') => { if (!disposed) onStatus({ phase, message, cached: [...entries.values()].filter(e => e.url).length }); };
  const release = entry => { if (entry.url) revokeUrl(entry.url); };
  function failure() {
    failed = true; ready = false; busy = null; clearTimer(timer); worker?.terminate(); worker = null;
    for (const entry of entries.values()) if (!entry.url) entry.error = true;
    report('error', 'Голоса временно недоступны. Музыкальный эфир продолжается.');
  }
  function pump() {
    if (!ready || busy || failed || disposed) return;
    const entry = [...entries.values()].find(e => !e.url && !e.error && !e.started);
    if (!entry) { if (![...entries.values()].some(e => e.error)) report('ready'); return; }
    busy = entry; entry.started = true; entry.id = ++serial;
    timer = setTimer(failure, 90000);
    report('rendering', 'Готовим следующий разговор…');
    worker.postMessage({ type: 'render', id: entry.id, script: entry.track.script, modelRevision: entry.track.modelRevision });
  }
  function start() {
    if (worker || failed || disposed) return;
    try {
      worker = workerFactory();
      worker.onerror = failure;
      worker.onmessage = ({ data }) => {
        if (disposed) return;
        if (data.type === 'ready') { clearTimer(timer); ready = true; pump(); return; }
        if (!busy || data.id !== busy.id) { if (data.type === 'error' && data.id === undefined) failure(); return; }
        clearTimer(timer);
        const entry = busy; busy = null;
        if (data.type === 'done' && data.durationMs === (entry.track.script.durationMs ?? 90000) && data.wav instanceof ArrayBuffer) {
          if (entries.get(entry.key) === entry) { entry.url = createUrl(data.wav); entry.metrics = { generationMs: data.generationMs, speechSeconds: data.speechSeconds }; onReady(entry.track); }
        } else { entry.error = true; report('error', 'Этот разговор недоступен. Музыкальный эфир продолжается.'); }
        pump();
      };
      timer = setTimer(failure, 60000);
      worker.postMessage({ type: 'load', settings: { ...runtime, model: { ...runtime.model, src: resolveUrl(runtime.model.src) },
        config: { ...runtime.config, src: resolveUrl(runtime.config.src) },
        ortModuleUrl: resolveUrl(runtime.ort.baseUrl + 'ort.wasm.min.mjs'), ortBaseUrl: resolveUrl(runtime.ort.baseUrl) } });
      report('loading', 'Загружаем голоса А и Б…');
    } catch { failure(); }
  }
  return {
    prepare(tracks) {
      if (disposed) return;
      const selected = tracks.filter(t => t?.script).slice(0, 2), keep = new Set(selected.map(keyFor));
      for (const [key, entry] of entries) if (!keep.has(key)) { release(entry); entries.delete(key); }
      for (const track of selected) {
        const key = keyFor(track);
        if (!entries.has(key)) entries.set(key, { key, track, started: false, error: failed });
      }
      if (selected.length) start();
      pump();
    },
    urlFor(track) { return entries.get(keyFor(track))?.url ?? null; },
    metricsFor(track) { return entries.get(keyFor(track))?.metrics ?? null; },
    dispose() {
      disposed = true; clearTimer(timer); worker?.terminate(); worker = null; busy = null;
      for (const entry of entries.values()) release(entry);
      entries.clear();
    },
  };
}
