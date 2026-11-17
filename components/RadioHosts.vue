<template>
  <details class="radio-hosts">
    <summary>
      <span class="host-avatars" aria-hidden="true">
        <img v-for="host in hosts" :key="host.voice" :src="asset(host.image)" alt="" width="36" height="36" loading="lazy">
      </span>
      <span>Знакомьтесь: {{ names }}<small>Ведущие варп-эфира · личные дела</small></span>
      <span class="hosts-chevron" aria-hidden="true">⌄</span>
    </summary>
    <button class="host-animation-toggle" type="button" :aria-pressed="!animated" @click="animated = !animated">
      {{ animated ? 'Остановить анимацию' : 'Включить анимацию' }}
    </button>
    <div class="host-grid">
      <article v-for="host in hosts" :key="host.voice" class="host-card">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" :srcset="asset(host.image)">
          <img class="host-portrait" :src="asset(animated ? host.animation : host.image)" :alt="host.alt" width="640" height="640" loading="lazy">
        </picture>
        <div class="host-dossier">
          <p class="eyebrow">{{ host.role }}</p>
          <h2>{{ host.name }}</h2>
          <p class="host-tagline">{{ host.tagline }}</p>
          <h3>Из личного дела</h3>
          <p>{{ host.biography }}</p>
          <h3>Характер</h3>
          <p>{{ host.personality }}</p>
          <blockquote>«{{ host.quote }}»</blockquote>
        </div>
      </article>
    </div>
  </details>
</template>

<script setup>
import { ref } from 'vue';
import hosts from '~/content/radio-hosts.json';
import { radioAudioUrl } from '~/utils/radio-schedule.mjs';

const names = hosts.map(host => host.name).join(' и ');
const animated = ref(true);
const baseURL = useRuntimeConfig().app.baseURL;
const asset = path => radioAudioUrl(baseURL, path);
</script>

<style scoped>
.radio-hosts { margin-top: 14px; border-top: 1px solid var(--line); }
summary { display: flex; align-items: center; gap: 12px; padding-top: 14px; cursor: pointer; font-size: 13px; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
summary small { display: block; color: var(--muted); font-size: 10px; margin-top: 2px; }
.host-avatars { display: flex; flex-shrink: 0; padding-right: 4px; }
.host-avatars img { width: 36px; height: 36px; object-fit: cover; border: 1px solid #9f7850; border-radius: 50%; }
.host-avatars img + img { margin-left: -6px; }
.hosts-chevron { margin-left: auto; font-size: 20px; transition: transform .15s; }
details[open] .hosts-chevron { transform: rotate(180deg); }
.host-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 18px; }
.host-animation-toggle { display: block; margin: 14px 0 0 auto; padding: 6px 10px; border: 1px solid var(--line); background: #0d1118; color: var(--muted); font-size: 11px; cursor: pointer; }
.host-animation-toggle:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .host-animation-toggle { display: none; } .hosts-chevron { transition: none; } }
.host-card { min-width: 0; border: 1px solid var(--line); background: #0d1118; }
.host-portrait { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; }
.host-dossier { padding: 20px; }
.host-dossier h2 { margin: 5px 0 6px; font-family: Georgia, serif; font-size: 27px; line-height: 1.2; }
.host-tagline { color: #c9b28d; font-size: 13px; }
.host-dossier h3 { margin-top: 20px; margin-bottom: 5px; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
.host-dossier h3 + p { font-size: 13px; line-height: 1.75; }
blockquote { margin: 20px 0 0; padding-left: 12px; border-left: 2px solid #9f7850; font-family: Georgia, serif; font-style: italic; color: #c9b28d; font-size: 16px; }
@media (max-width: 640px) {
  .host-grid { grid-template-columns: minmax(0, 1fr); }
  .host-dossier { padding: 16px; }
  summary { font-size: 12px; }
}
</style>
