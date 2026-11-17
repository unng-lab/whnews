<script setup>
import { catalog, worlds, systems } from '~/utils/data';
import { pageSlice, placeHref, placeNews, searchActors } from '~/utils/catalog.mjs';

const props = defineProps({ kind: { type: String, required: true }, page: { type: Number, default: 1 } });
const title = computed(() => props.kind === 'worlds' ? 'Миры' : 'Системы');
const places = computed(() => props.kind === 'worlds' ? worlds : systems);
const query = ref('');
const searchPage = ref(1);
const pageOverride = ref(null);
const searching = computed(() => !!query.value.trim());
const selection = computed(() => {
  try { return pageSlice(searchActors(places.value, query.value), searching.value ? searchPage.value : (pageOverride.value ?? props.page)); }
  catch { throw createError({ statusCode: 404, statusMessage: 'Страница каталога не найдена' }); }
});
const counts = computed(() => Object.fromEntries(places.value.map(place => [place.id, placeNews(catalog, props.kind, place.id).length])));
watch(query, (value, previous) => {
  searchPage.value = 1;
  if (!value.trim() && previous.trim()) {
    pageOverride.value = 1;
    if (props.page > 1) navigateTo(`/${props.kind}/`);
  }
}, { flush: 'sync' });
watch(() => [props.page, props.kind], () => { query.value = ''; searchPage.value = 1; pageOverride.value = null; });
useHead({ title: computed(() => `${title.value} — Life is Better`) });
</script>

<template>
  <section>
    <header class="page-heading">
      <p class="eyebrow">Картографический архив / вымышленная география</p>
      <h1>{{ title }}</h1>
      <p>{{ kind === 'worlds' ? 'Миры далёкого будущего: их история, системы и связанные хроники.' : 'Созвездия миров и объединений: общие маршруты, летописи и хроники.' }}</p>
    </header>
    <div class="actor-search place-search">
      <label :for="`${kind}-search`">{{ kind === 'worlds' ? 'Найти мир' : 'Найти систему' }}</label>
      <input :id="`${kind}-search`" v-model="query" type="search" placeholder="Название…" autocomplete="off">
      <p class="search-count" aria-live="polite">{{ searching ? 'Найдено' : 'Всего записей' }}: {{ selection.totalItems }}</p>
    </div>
    <div class="place-grid">
      <article v-for="place in selection.items" :key="place.id" class="place-card">
        <p class="eyebrow">{{ kind === 'worlds' ? 'Мир' : 'Система' }}</p>
        <h2><NuxtLink :to="placeHref(kind, place.id)">{{ place.name }}</NuxtLink></h2>
        <p class="place-description">{{ place.description }}</p>
        <div class="place-card-bottom"><span>Хроник: {{ counts[place.id] }}</span><NuxtLink class="small-link" :to="placeHref(kind, place.id)">Открыть летопись ↗</NuxtLink></div>
      </article>
    </div>
    <p v-if="!selection.items.length" class="empty-state">{{ searching ? 'Ничего не найдено. Попробуйте другое название.' : 'Картографический архив пока пуст. Записи появятся после публикации.' }}</p>
    <SitePagination :page="selection" :base="`/${kind}/`" :label="`Страницы: ${title}`" :interactive="searching" @change="searchPage = $event" />
  </section>
</template>
