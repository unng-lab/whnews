<script setup>
import { people } from '~/utils/data';
import { parsePage } from '~/utils/catalog.mjs';
const route = useRoute();
const page = computed(() => parsePage(route.params.page));
if (page.value === null) throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
useHead({ title: computed(() => `Действующие лица · ${page.value} — WHNEWS`) });
</script>
<template><header class="page-heading"><p class="eyebrow">Личные дела</p><h1>Действующие лица</h1><p>Персонажи и их хроники.</p></header><ActorDirectory :actors="people" :page="page" /></template>
