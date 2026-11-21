<template>
  <section class="radio-panel" aria-label="Варп-радио Life is Better">
    <div class="radio-heading">
      <span class="eyebrow"><span class="radio-light" :class="{ 'is-playing': state.playing }" aria-hidden="true"></span>Варп-эфир</span>
      <span class="radio-edition">{{ catalog.tracks.length }} песни · {{ hostNames }}</span>
    </div>
    <div class="radio-controls">
      <button class="radio-toggle" type="button" :disabled="!ready" :aria-pressed="state.wanted" @click="toggle">
        <span aria-hidden="true">{{ state.wanted ? 'Ⅱ' : '▶' }}</span>
        {{ state.wanted ? 'Остановить' : 'Слушать' }}
      </button>
      <div class="radio-track">
        <p class="radio-track-title">{{ state.slot?.kind === 'dialogue' && !speechReady ? 'Музыкальная интерлюдия' : state.slot?.track.title ?? 'Подключитесь к музыкальному эфиру' }}</p>
        <p class="radio-track-meta">{{ state.slot?.track.genre ?? 'Музыка далёкого будущего' }}<span v-if="state.loading"> · Подключение…</span></p>
        <div class="radio-timeline" v-if="state.slot">
          <progress :value="state.slot.positionMs" :max="state.slot.track.durationMs" aria-label="Позиция трека в эфире"></progress>
          <span>{{ radioTime(state.slot.positionMs) }} / {{ radioTime(state.slot.track.durationMs) }}</span>
        </div>
      </div>
      <label class="radio-volume">Громкость
        <input type="range" min="0" max="100" step="1" v-model.number="volume" @input="changeVolume" aria-label="Громкость радио">
      </label>
    </div>
    <p v-if="state.error" class="radio-error" role="status">{{ state.error }}</p>
    <div v-if="state.wanted" class="radio-speech-status" role="status">
      <span>{{ voiceStatus.message }}</span>
      <button v-if="voiceStatus.phase === 'error'" type="button" @click="retrySpeech">Повторить подготовку голосов</button>
      <NuxtLink v-if="speechReady && state.slot?.track.sourceHref" :to="state.slot.track.sourceHref">Читать обсуждаемую хронику ↗</NuxtLink>
    </div>
    <div class="radio-footer">
      <p v-if="state.slot">Далее: {{ state.slot.nextTrack.title }}</p><p v-else>Музыкальный сигнал из сорок первого тысячелетия.</p>
      <span>Фанатский эфир · голоса создаются на устройстве</span>
    </div>
    <RadioHosts />
    <div v-show="previewTrack" class="radio-preview">
      <div class="radio-preview-heading">
        <p>{{ previewTrack?.title }}</p>
        <button type="button" @click="clearPreview">Закрыть проигрыватель</button>
      </div>
      <audio ref="preview" controls preload="none" aria-label="Проигрыватель выбранного трека" @error="onPreviewError"></audio>
      <p v-if="previewError" class="radio-error" role="status">{{ previewError }}</p>
    </div>
    <details class="radio-library" @toggle="libraryOpen = $event.target.open">
      <summary>Список треков ({{ catalog.tracks.length }})</summary>
      <div v-if="libraryOpen">
        <label class="radio-search">
          Поиск по названию и жанру
          <input type="search" v-model.trim="query" @input="trackPage = 0">
        </label>
        <nav v-if="pageCount > 1" class="radio-pages" aria-label="Страницы треков">
          <button type="button" :disabled="trackPage === 0" @click="trackPage--">Назад</button>
          <span aria-live="polite">{{ trackPage + 1 }} из {{ pageCount }}</span>
          <button type="button" :disabled="trackPage + 1 >= pageCount" @click="trackPage++">Далее</button>
        </nav>
        <ol v-if="filteredTracks.length" aria-label="Треки радио">
          <li v-for="track in pageTracks" :key="track.id">
            <button type="button" :aria-label="`Слушать «${track.title}»`" @click="playTrack(track)">
              <span>{{ track.title }}<small v-if="track.genre">{{ track.genre }}</small></span>
              <span>{{ radioTime(track.durationMs) }} <span aria-hidden="true">▶</span></span>
            </button>
          </li>
        </ol>
        <p v-else>Треки по этому запросу не найдены.</p>
      </div>
    </details>
    <noscript>Для прослушивания радио включите JavaScript.</noscript>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import manifest from '~/content/radio.json';
import hosts from '~/content/radio-hosts.json';
import { radioAudioUrl, radioTime } from '~/utils/radio-schedule.mjs';
import { createRadioPlayer } from '~/utils/radio-player.mjs';
import { createCatalogRadioSchedule, fetchRadioProgram } from '~/utils/radio-program.mjs';
import { createSpeechEngine, validateVoiceRuntime } from '~/utils/radio-speech.mjs';

const baseURL = useRuntimeConfig().app.baseURL;
const hostNames = hosts.map(host => host.name).join(' и ');
const ready = ref(false), volume = ref(50);
const pageSize = 30;
const libraryOpen = ref(false), trackPage = ref(0), query = ref('');
const catalog = shallowRef(manifest);
const preview = ref(null), previewTrack = shallowRef(null), previewError = ref('');
const filteredTracks = computed(() => {
  const term = query.value.toLocaleLowerCase('ru');
  if (!term) return catalog.value.tracks;
  return catalog.value.tracks.filter(track => `${track.title} ${track.genre ?? ''}`.toLocaleLowerCase('ru').includes(term));
});
const pageCount = computed(() => Math.ceil(filteredTracks.value.length / pageSize));
const pageTracks = computed(() => {
  const start = trackPage.value * pageSize;
  return filteredTracks.value.slice(start, start + pageSize);
});
const state = shallowRef({ wanted: false, playing: false, loading: false, error: '', slot: null });
const voiceStatus = shallowRef({ phase: 'idle', message: '' });
const schedule = createCatalogRadioSchedule(manifest);
let player, timer, poll, speech, runtime, request, disposed = false;
const asset = path => radioAudioUrl(baseURL, path);
const speechReady = computed(() => state.value.slot?.kind === 'dialogue' && !!speech?.urlFor(state.value.slot.track));
const resync = () => { if (!document.hidden) { player?.tick(true); refreshProgram(); } };
async function refreshProgram() {
  if (disposed || request) return;
  const controller = new AbortController(); request = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const [programResult, runtimeResult] = await Promise.allSettled([
      fetchRadioProgram(asset('/radio/program.json'), { signal: controller.signal }),
      runtime ? Promise.resolve(runtime) : fetch(asset('/radio/voice/runtime-v1.json'), { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(validateVoiceRuntime),
    ]);
    if (disposed) return;
    if (runtimeResult.status === 'fulfilled') runtime = runtimeResult.value;
    if (programResult.status === 'fulfilled') {
      if (runtime && runtime.model.sha256 !== programResult.value.modelRevision) throw new Error('Incompatible voice edition');
      schedule.update(programResult.value);
      catalog.value = schedule.music;
      player?.tick(true);
    }
  } catch { /* Retain the last validated static program. */ }
  finally { clearTimeout(timeout); if (request === controller) request = null; }
}
function makeSpeech() {
  speech?.dispose(); speech = null;
  if (!runtime) { voiceStatus.value = { phase: 'error', message: 'Голоса пока недоступны. Музыка продолжает звучать.' }; return; }
  speech = createSpeechEngine({ runtime, resolveUrl: asset,
    workerFactory: () => new Worker(new URL('../workers/radio-speech.worker.mjs', import.meta.url), { type: 'module' }),
    onStatus: status => { voiceStatus.value = status; }, onReady: () => player?.tick(true) });
}
async function retrySpeech() { if (!runtime) await refreshProgram(); if (!disposed && state.value.wanted) { makeSpeech(); speech?.prepare(schedule.speechSlots(Date.now())); } }
function toggle() {
  if (state.value.wanted) { player.stop(); speech?.dispose(); speech = null; voiceStatus.value = { phase: 'idle', message: '' }; }
  else { clearPreview(); makeSpeech(); player.start(); }
}
function clearPreview() {
  if (!previewTrack.value || !preview.value) return;
  previewTrack.value = null;
  previewError.value = '';
  preview.value.pause();
  preview.value.removeAttribute('src');
  preview.value.load();
}
function onPreviewError() {
  if (previewTrack.value) previewError.value = 'Трек пока недоступен. Попробуйте запустить его ещё раз.';
}
function playTrack(track) {
  const audio = preview.value;
  if (!audio) return;
  if (state.value.wanted) toggle();
  previewTrack.value = track;
  previewError.value = '';
  audio.volume = volume.value / 100;
  audio.src = asset(track.src);
  audio.play().catch(error => {
    if (error.name !== 'AbortError' && previewTrack.value === track) onPreviewError();
  });
  nextTick(() => { if (previewTrack.value === track) audio.focus(); });
}
function changeVolume() {
  player?.setVolume(volume.value / 100);
  if (preview.value) preview.value.volume = volume.value / 100;
  try { localStorage.setItem('whnews-radio-volume', String(volume.value)); } catch { /* Storage can be disabled. */ }
}
onMounted(async () => {
  try {
    const stored = localStorage.getItem('whnews-radio-volume');
    if (stored !== null && Number.isFinite(Number(stored))) volume.value = Math.max(0, Math.min(100, Number(stored)));
  } catch { /* Start at a moderate volume without persistence. */ }
  await refreshProgram();
  if (disposed) return;
  player = createRadioPlayer({ audio: new Audio(), schedule,
    resolveUrl: track => track.kind === 'dialogue' ? speech?.urlFor(track) ?? asset(track.src) : asset(track.src),
    onChange: next => {
      state.value = next;
      if (next.wanted) speech?.prepare(schedule.speechSlots(Date.now()));
      else { speech?.dispose(); speech = null; }
    } });
  player.setVolume(volume.value / 100); player.tick(); ready.value = true;
  timer = setInterval(() => player.tick(), 1000);
  poll = setInterval(refreshProgram, 60000);
  document.addEventListener('visibilitychange', resync);
  window.addEventListener('pageshow', resync);
});
onBeforeUnmount(() => {
  disposed = true; clearPreview(); request?.abort(); clearInterval(timer); clearInterval(poll); document.removeEventListener('visibilitychange', resync);
  window.removeEventListener('pageshow', resync); player?.dispose(); speech?.dispose();
});
</script>

<style scoped>
.radio-panel { margin-top: 24px; padding: 18px 20px 14px; border: 1px solid var(--line); border-left: 3px solid #9f2034; background: linear-gradient(115deg, #1a202b, #10141b); }
.radio-heading, .radio-footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.radio-heading { margin-bottom: 12px; align-items: center; }
.radio-light { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--muted); margin-right: 8px; }
.radio-light.is-playing { background: var(--red); box-shadow: 0 0 10px #ef596977; }
.radio-edition, .radio-footer { font-size: 10px; color: var(--muted); }
.radio-controls { display: grid; grid-template-columns: 132px minmax(0, 1fr) 110px; align-items: center; gap: 22px; }
.radio-toggle { min-height: 44px; padding: 10px 12px; border: 1px solid #85414b; background: #27151c; font-size: 12px; }
.radio-toggle:hover { background: #3a1b25; }
.radio-toggle:disabled { opacity: .5; cursor: wait; }
.radio-toggle span { margin-right: 5px; }
.radio-track { min-width: 0; }
.radio-track-title { font-size: 16px; line-height: 1.4; overflow-wrap: anywhere; }
.radio-track-meta { font-size: 10px; color: var(--muted); }
.radio-timeline { display: flex; align-items: center; gap: 12px; margin-top: 6px; }
.radio-timeline progress { width: 100%; height: 3px; accent-color: var(--red); border: 0; }
.radio-timeline span { font-size: 10px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.radio-volume { font-size: 10px; color: var(--muted); }
.radio-volume input { display: block; width: 100%; min-height: 32px; accent-color: var(--red); }
.radio-footer { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
.radio-error { margin-top: 12px; color: #ff9eaa; font-size: 12px; }
.radio-speech-status { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--muted); margin-top: 10px; }
.radio-speech-status button { border: 0; padding: 0; background: none; text-decoration: underline; }
.radio-library { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
.radio-library summary { cursor: pointer; }
.radio-search { display: grid; gap: 6px; margin: 10px 0; max-width: 440px; font-size: 12px; }
.radio-search input { padding: 8px; border: 1px solid var(--line); background: #10141b; }
.radio-library li button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px; text-align: left; border-bottom: 1px solid var(--line); }
.radio-library li button:hover { background: #27151c; }
.radio-library small { display: block; color: var(--muted); }
.radio-pages, .radio-preview-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.radio-pages { margin: 8px 0; }
.radio-pages button, .radio-preview-heading button { text-decoration: underline; }
.radio-pages button:disabled { opacity: .5; }
.radio-preview { margin-top: 12px; }
.radio-preview audio { width: 100%; margin-top: 4px; }
@media (max-width: 760px) {
  .radio-panel { padding: 14px; }
  .radio-controls { grid-template-columns: minmax(0, 1fr) 100px; gap: 12px; }
  .radio-track { grid-column: 1 / -1; grid-row: 1; }
  .radio-toggle { grid-row: 2; }
  .radio-track-title { font-size: 15px; }
  .radio-footer { display: block; }
}
</style>
