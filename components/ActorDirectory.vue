<script setup>
import { actorHref, pageSlice, searchActors } from '~/utils/catalog.mjs';
const props = defineProps({ actors: { type: Array, required: true }, page: { type: Number, default: 1 }, compact: Boolean });
const query = ref('');
const searchPage = ref(1);
const pageOverride = ref(null);
const searching = computed(() => !!query.value.trim());
const filtered = computed(() => searchActors(props.actors, query.value));
const current = computed(() => searching.value ? searchPage.value : (pageOverride.value ?? props.page));
const selection = computed(() => {
  try { return pageSlice(filtered.value, current.value); }
  catch { throw createError({ statusCode: 404, statusMessage: 'Страница каталога не найдена' }); }
});
watch(query, (value, previous) => {
  searchPage.value = 1;
  if (!value.trim() && previous.trim()) {
    pageOverride.value = 1;
    if (props.page > 1) navigateTo('/actors/');
  }
}, { flush: 'sync' });
watch(() => props.page, () => { query.value = ''; searchPage.value = 1; pageOverride.value = null; });
const searchId = computed(() => props.compact ? 'sidebar-actor-search' : 'catalog-actor-search');
</script>

<template>
  <section class="actor-directory" :class="{ compact }" aria-label="Каталог действующих лиц">
    <div v-if="compact" class="section-heading"><div><p class="eyebrow">Личные дела</p><h2>Действующие лица</h2></div><NuxtLink to="/actors/" class="small-link">Все лица ↗</NuxtLink></div>
    <div class="actor-search"><label :for="searchId">Найти персонажа</label><input :id="searchId" v-model="query" type="search" placeholder="Имя персонажа…" autocomplete="off"><p v-if="searching" class="search-count" aria-live="polite">Найдено: {{ filtered.length }}</p></div>
    <div class="actor-cards" :class="{ 'actor-cards-grid': !compact }">
      <article v-for="actor in selection.items" :key="actor.id" class="actor-card">
        <NuxtLink :to="actorHref(actor.id)" class="actor-portrait-link" tabindex="-1" aria-hidden="true"><img v-if="actor.image" :src="actor.image" :alt="actor.name" loading="lazy" width="240" height="300"><span v-else class="portrait-pending">Портрет пока<br>не добавлен</span></NuxtLink>
        <div class="actor-card-copy"><h3><NuxtLink :to="actorHref(actor.id)">{{ actor.name }}</NuxtLink></h3><p>{{ actor.description }}</p><NuxtLink v-if="!compact" class="small-link" :to="actorHref(actor.id)">Личное дело и хроники ↗</NuxtLink></div>
      </article>
    </div>
    <p v-if="!selection.items.length" class="empty-state">Персонажи не найдены. Попробуйте другое имя.</p>
    <SitePagination :page="selection" base="/actors/" label="Страницы персонажей" :interactive="searching" @change="searchPage = $event" />
  </section>
</template>
