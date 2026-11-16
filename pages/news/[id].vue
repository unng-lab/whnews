<script setup>
import { people, stories } from '~/utils/data';
import { actorHref, formatDate } from '~/utils/catalog.mjs';
const route = useRoute();
const story = computed(() => {
  const entry = stories.find(item => item.id === route.params.id);
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Хроника не найдена' });
  return entry;
});
const participants = computed(() => story.value.actorIds.map(id => people.find(actor => actor.id === id)).filter(Boolean));
useHead({ title: computed(() => `${story.value?.title ?? 'Хроника'} — WHNEWS`) });
</script>
<template><article v-if="story" class="chronicle-page"><NuxtLink to="/news/" class="back-link">← Все хроники</NuxtLink><header><p class="eyebrow">Вымышленная хроника <span v-if="!story.source">/ из архива</span></p><h1>{{ story.title }}</h1><p class="story-meta">Опубликовано <time :datetime="story.date">{{ formatDate(story.date) }}</time></p></header><p class="chronicle-body">{{ story.text }}</p><section v-if="participants.length" class="chronicle-people" aria-labelledby="chronicle-people-heading">
  <h2 id="chronicle-people-heading">Действующие лица</h2>
  <ul class="chronicle-participants">
    <li v-for="actor in participants" :key="actor.id">
      <NuxtLink :to="actorHref(actor.id)" class="chronicle-participant">
        <img v-if="actor.image" :src="actor.image" alt="" loading="lazy" width="240" height="300">
        <span v-else class="portrait-pending">Портрет пока не добавлен</span>
        <span class="chronicle-participant-name">{{ actor.name }}</span>
      </NuxtLink>
    </li>
  </ul>
</section><aside class="source-note"><p>Художественная сатира. Описанные образы и формулировки принадлежат вымышленному миру WHNEWS.</p><template v-if="story.source"><a :href="story.source.url" target="_blank" rel="noopener noreferrer">Исходная новость RT ↗</a><p v-if="story.source.publishedAt">Дата первоисточника: <time :datetime="story.source.publishedAt">{{ formatDate(story.source.publishedAt) }}</time></p></template><p v-else>Архивная запись: исходная ссылка не сохранилась.</p></aside></article></template>
