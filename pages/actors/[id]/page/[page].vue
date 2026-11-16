<script setup>
import { parsePage } from '~/utils/catalog.mjs';
const route = useRoute();
const id = computed(() => String(route.params.id));
const page = computed(() => parsePage(route.params.page));
if (page.value === null) throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' });
</script>
<template><ActorProfile :id="id" :page="page" /></template>
