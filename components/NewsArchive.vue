<script setup>
import { people, stories } from '~/utils/data';
import { pageSlice } from '~/utils/catalog.mjs';
const props = defineProps({ page: { type: Number, default: 1 }, home: Boolean });
const selection = computed(() => {
  try { return pageSlice(stories, props.page); }
  catch { throw createError({ statusCode: 404, statusMessage: 'Страница хроник не найдена' }); }
});
useHead({ title: computed(() => props.home ? 'Life is Better — хроники далёкого будущего' : `Архив хроник · ${props.page} — Life is Better`) });
</script>

<template>
  <div>
    <section v-if="home" class="edition-intro"><p class="eyebrow">Архив Империума</p><h1>Реальные события.<br><em>Хроники далёкого будущего.</em></h1><p>Знакомые действующие лица — по ту сторону сорок первого тысячелетия. Художественная сатира по мотивам новостной повестки.</p></section>
    <header v-else class="page-heading"><p class="eyebrow">Все донесения</p><h1>Архив хроник</h1><p>События, сохранённые в летописях далёкого будущего.</p></header>
    <div class="editorial-columns"><section id="feed" class="main-column" aria-label="Новостная лента"><div class="section-heading"><h2 class="section-title">{{ home ? 'Последние хроники' : 'Лента донесений' }}</h2><span class="edition-label">Страница {{ selection.page }} / {{ selection.totalPages }}</span></div><NewsFeed :news="selection.items" :actors="people" :featured="home" /><SitePagination :page="selection" base="/news/" label="Страницы хроник" /></section><aside class="sidebar"><ActorDirectory :actors="people" compact /></aside></div>
  </div>
</template>
