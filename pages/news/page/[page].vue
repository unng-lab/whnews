<script setup>
import { parsePage } from '~/utils/catalog.mjs';
const route = useRoute();
const page = computed(() => parsePage(route.params.page));
if (page.value === null) throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
</script>
<template><NewsArchive :page="page" /></template>
