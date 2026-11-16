<script setup>
import first from '~/public/worlds/page-1.json';
import second from '~/public/worlds/page-2.json';
import third from '~/public/worlds/page-3.json';
const worlds = [...first, ...second, ...third];
useHead({ title: 'Миры — WHNEWS' });
</script>
<template><header class="page-heading"><p class="eyebrow">Картографический архив</p><h1>Миры</h1><p>Сохранённые записи о далёких мирах.</p></header><div class="legacy-list"><article v-for="(world, index) in worlds" :key="index"><h2>{{ world.name }}</h2><p>{{ world.description }}</p></article></div></template>
