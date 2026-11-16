<script setup>
import { parsePage } from '~/utils/catalog.mjs';
const route = useRoute();
const id = computed(() => String(route.params.id));
const page = computed(() => {
  const value = parsePage(route.params.page);
  if (value === null) throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
  return value;
});
</script>
<template><PlaceProfile kind="systems" :id="id" :page="page" /></template>
