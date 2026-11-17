// Audio transport is injected so clock changes, buffering and play races can be tested without a browser.
export function createRadioPlayer({ audio, schedule, now = Date.now, resolveUrl = track => track.src, onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const state = { wanted: false, playing: false, loading: false, error: '', slot: schedule.atUtc(now()) };
  let loadedId = null, loadedSource = null, generation = 0, pending = null, disposed = false, boundaryTimer = null;
  audio.preload = 'none';
  const emit = () => { if (!disposed) onChange({ ...state }); };
  function fail(message) {
    state.wanted = false; state.playing = false; state.loading = false; state.error = message;
    clearTimer(boundaryTimer); boundaryTimer = null;
    generation++; pending = null; loadedId = null; audio.pause(); emit();
  }
  function play() {
    if (!state.wanted || (pending && pending.generation === generation)) return;
    const attempt = { generation }; pending = attempt;
    let result;
    try { result = audio.play(); }
    catch { if (attempt.generation === generation) fail('Не удалось начать воспроизведение. Нажмите «Слушать» ещё раз.'); return; }
    Promise.resolve(result).then(() => {
      if (disposed || attempt.generation !== generation) return;
      state.playing = !audio.paused; state.loading = false; emit();
    }).catch(() => {
      if (!disposed && attempt.generation === generation) fail('Эфир не запустился. Проверьте соединение и нажмите «Слушать».');
    }).finally(() => { if (pending === attempt) pending = null; });
  }
  function seek(force) {
    if (audio.readyState < 1 || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const target = Math.min(state.slot.positionMs / 1000, Math.max(0, audio.duration - 0.05));
    if (force || Math.abs(audio.currentTime - target) > 1.5) {
      try { audio.currentTime = target; } catch { /* Retry on metadata/canplay or the next tick. */ }
    }
  }
  function tick(force = false) {
    if (disposed) return;
    state.slot = schedule.atUtc(now());
    clearTimer(boundaryTimer); boundaryTimer = null;
    if (state.wanted) {
      boundaryTimer = setTimer(() => tick(true), Math.max(1, state.slot.remainingMs));
      boundaryTimer?.unref?.();
      const source = resolveUrl(state.slot.track);
      if (loadedId !== state.slot.track.id || loadedSource !== source) {
        generation++; pending = null; loadedId = state.slot.track.id; loadedSource = source;
        state.playing = false; state.loading = true;
        audio.src = source; audio.load();
        seek(true); play();
      } else {
        seek(force);
        // Some decoders end a fraction before the catalog boundary. Wait for the next UTC slot.
        if (audio.paused && !audio.ended) play();
      }
    }
    emit();
  }
  const events = {
    loadedmetadata: () => { if (state.wanted) tick(true); },
    canplay: () => { if (state.wanted) tick(); },
    playing: () => {
      if (!state.wanted) { audio.pause(); return; }
      state.playing = true; state.loading = false; emit();
    },
    waiting: () => { if (state.wanted) { state.loading = true; emit(); } },
    ended: () => { state.playing = false; tick(); },
    error: () => { if (state.wanted) fail('Аудиофайл недоступен. Попробуйте подключиться к эфиру ещё раз.'); },
  };
  for (const [name, listener] of Object.entries(events)) audio.addEventListener(name, listener);
  function stop() {
    clearTimer(boundaryTimer); boundaryTimer = null;
    generation++; pending = null; state.wanted = false; state.playing = false; state.loading = false;
    audio.pause(); audio.removeAttribute('src'); loadedId = null; loadedSource = null; audio.load(); emit();
  }
  return {
    tick,
    start() { if (!disposed) { state.error = ''; state.wanted = true; tick(true); } },
    stop,
    setVolume(value) { audio.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5)); },
    dispose() {
      stop(); disposed = true;
      for (const [name, listener] of Object.entries(events)) audio.removeEventListener(name, listener);
    },
  };
}
