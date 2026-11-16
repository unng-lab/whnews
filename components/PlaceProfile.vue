<script setup>
import { catalog, people, worlds, systems } from '~/utils/data';
import { pageSlice, placeHref, placeNews } from '~/utils/catalog.mjs';

const props = defineProps({ kind: { type: String, required: true }, id: { type: String, required: true }, page: { type: Number, default: 1 } });
const isWorld = computed(() => props.kind === 'worlds');
const place = computed(() => {
  const found = (isWorld.value ? worlds : systems).find(item => item.id === props.id);
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Запись картографического архива не найдена' });
  return found;
});
const related = computed(() => isWorld.value
  ? systems.filter(system => place.value.systemIds.includes(system.id))
  : worlds.filter(world => world.systemIds.includes(place.value.id)));
const selection = computed(() => {
  // Resolve identity before paginating an empty result for an unknown ID.
  const id = place.value.id;
  try { return pageSlice(placeNews(catalog, props.kind, id), props.page); }
  catch { throw createError({ statusCode: 404, statusMessage: 'Страница подборки не найдена' }); }
});
useHead({ title: computed(() => `${place.value.name} — WHNEWS`) });
</script>

<template>
  <article class="place-profile">
    <NuxtLink class="back-link" :to="`/${kind}/`">← {{ isWorld ? 'Все миры' : 'Все системы' }}</NuxtLink>
    <header class="page-heading">
      <p class="eyebrow">Картографический архив / {{ isWorld ? 'вымышленный мир' : 'вымышленная система' }}</p>
      <h1>{{ place.name }}</h1><p>{{ place.description }}</p>
    </header>
    <section class="place-relations" :aria-label="isWorld ? 'Системы мира' : 'Миры системы'">
      <h2>{{ isWorld ? 'Системы мира' : 'Миры системы' }}</h2>
      <div v-if="related.length" class="actor-tags"><NuxtLink v-for="item in related" :key="item.id" :to="placeHref(isWorld ? 'systems' : 'worlds', item.id)">{{ item.name }}</NuxtLink></div>
      <p v-else class="profile-note">{{ isWorld ? 'Принадлежность к системам пока не определена.' : 'В этой системе пока нет описанных миров.' }}</p>
    </section>
    <section class="profile-chronicles">
      <div class="section-heading"><h2>{{ isWorld ? 'Хроники мира' : 'Хроники системы' }}</h2><span class="edition-label">{{ selection.totalItems }} записей</span></div>
      <NewsFeed :news="selection.items" :actors="people" />
      <SitePagination :page="selection" :base="placeHref(kind, place.id)" label="Страницы подборки хроник" />
    </section>
  </article>
</template>
