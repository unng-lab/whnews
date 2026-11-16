<script setup>
import { actorHref, formatDate, newsHref } from '~/utils/catalog.mjs';
defineProps({ news: { type: Array, required: true }, actors: { type: Array, required: true }, featured: Boolean });
</script>

<template>
  <div class="news-feed">
    <article v-for="(story, index) in news" :key="story.id" class="news-entry" :class="{ 'news-entry-featured': featured && index === 0 }">
      <div class="story-meta"><span class="eyebrow">{{ story.source ? 'Вымышленная хроника' : 'Из архива' }}</span><span aria-hidden="true">/</span><time :datetime="story.date">{{ formatDate(story.date) }}</time></div>
      <h2><NuxtLink :to="newsHref(story.id)">{{ story.title }}</NuxtLink></h2>
      <p class="story-text">{{ story.text }}</p>
      <div class="story-bottom">
        <div v-if="story.actorIds.length" class="actor-tags"><NuxtLink v-for="id in story.actorIds" :key="id" :to="actorHref(id)">{{ actors.find(actor => actor.id === id)?.name }}</NuxtLink></div>
        <a v-if="story.source" class="source-link" :href="story.source.url" target="_blank" rel="noopener noreferrer">Исходная новость RT <span aria-hidden="true">↗</span></a>
        <NuxtLink v-else class="source-link" :to="newsHref(story.id)">Открыть хронику <span aria-hidden="true">↗</span></NuxtLink>
      </div>
    </article>
    <p v-if="!news.length" class="empty-state">В этой подборке пока нет хроник. Новые записи появятся здесь после публикации.</p>
  </div>
</template>
