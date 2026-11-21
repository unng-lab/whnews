<script setup>
import { parsePage } from '~/utils/catalog.mjs';
const route = useRoute();
const page = computed(() => {
  const value = parsePage(route.params.page);
  if (value === null) throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
  return value;
});
</script>
<template><PlaceDirectory kind="worlds" :page="page" /></template>
