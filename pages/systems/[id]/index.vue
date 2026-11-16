<script setup>
const route = useRoute();
const id = computed(() => String(route.params.id));
</script>
<template><PlaceProfile kind="systems" :id="id" /></template>
