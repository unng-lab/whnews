<script setup>
import { people, stories } from '~/utils/data';
import { actorHref, actorNews, pageSlice } from '~/utils/catalog.mjs';
const props = defineProps({ id: { type: String, required: true }, page: { type: Number, default: 1 } });
const person = computed(() => {
  const actor = people.find(actor => actor.id === props.id);
  if (!actor) throw createError({ statusCode: 404, statusMessage: 'Персонаж не найден' });
  return actor;
});
const selection = computed(() => {
  if (!person.value) throw createError({ statusCode: 404, statusMessage: 'Персонаж не найден' });
  try { return pageSlice(actorNews(stories, props.id), props.page); }
  catch { throw createError({ statusCode: 404, statusMessage: 'Страница подборки не найдена' }); }
});
useHead({ title: computed(() => `${person.value?.name ?? 'Персонаж'} — WHNEWS`) });
</script>

<template>
  <div v-if="person" class="profile-page"><NuxtLink class="back-link" to="/actors/">← Все действующие лица</NuxtLink><header class="actor-profile"><img v-if="person.image" :src="person.image" :alt="person.name" width="360" height="450"><div v-else class="portrait-pending">Портрет пока не добавлен</div><div><p class="eyebrow">Личное дело / вымышленный персонаж</p><h1>{{ person.name }}</h1><p class="profile-biography">{{ person.description }}</p><p class="profile-note">Художественный образ из мира WHNEWS.</p></div></header><section class="profile-chronicles"><div class="section-heading"><h2>Хроники с участием персонажа</h2><span class="edition-label">{{ selection.totalItems }} записей</span></div><NewsFeed :news="selection.items" :actors="people" /><SitePagination :page="selection" :base="actorHref(person.id)" label="Страницы подборки персонажа" /></section></div>
</template>
