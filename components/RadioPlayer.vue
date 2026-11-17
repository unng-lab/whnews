<template>
  <section class="radio-panel" aria-label="Варп-радио WHNEWS">
    <div class="radio-heading">
      <span class="eyebrow"><span class="radio-light" :class="{ 'is-playing': state.playing }" aria-hidden="true"></span>Варп-эфир</span>
      <span class="radio-edition">{{ manifest.tracks.length }} песни · ведущие А и Б</span>
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
    <noscript>Для прослушивания радио включите JavaScript.</noscript>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import manifest from '~/content/radio.json';
import { radioAudioUrl, radioTime } from '~/utils/radio-schedule.mjs';
import { createRadioPlayer } from '~/utils/radio-player.mjs';
import { createLiveRadioSchedule, fetchRadioProgram } from '~/utils/radio-program.mjs';
import { createSpeechEngine, validateVoiceRuntime } from '~/utils/radio-speech.mjs';

const baseURL = useRuntimeConfig().app.baseURL;
const ready = ref(false), volume = ref(50);
const state = shallowRef({ wanted: false, playing: false, loading: false, error: '', slot: null });
const voiceStatus = shallowRef({ phase: 'idle', message: '' });
const schedule = createLiveRadioSchedule(manifest);
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
      schedule.update(programResult.value); player?.tick(true);
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
  else { makeSpeech(); player.start(); }
}
function changeVolume() {
  player?.setVolume(volume.value / 100);
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
  disposed = true; request?.abort(); clearInterval(timer); clearInterval(poll); document.removeEventListener('visibilitychange', resync);
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
@media (max-width: 760px) {
  .radio-panel { padding: 14px; }
  .radio-controls { grid-template-columns: minmax(0, 1fr) 100px; gap: 12px; }
  .radio-track { grid-column: 1 / -1; grid-row: 1; }
  .radio-toggle { grid-row: 2; }
  .radio-track-title { font-size: 15px; }
  .radio-footer { display: block; }
}
</style>
