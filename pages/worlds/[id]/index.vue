<script setup>
const route = useRoute();
const id = computed(() => String(route.params.id));
</script>
<template><PlaceProfile kind="worlds" :id="id" /></template>
