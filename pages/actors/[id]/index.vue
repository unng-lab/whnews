<script setup>
const route = useRoute();
const id = computed(() => String(route.params.id));
</script>
<template><ActorProfile :id="id" /></template>
