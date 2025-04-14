<template>
  <div class="systems-grid">
    <SystemCard
        v-for="(system, index) in systems"
        :key="index"
        :system="system"
    />
  </div>
</template>

<script setup>
useHead({
  title: 'Imperial Systems - Warhammer 40k Database'
})

const { data: systems } = await useFetch('/content/systems.json')
</script>

<style>
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 1rem;
}
</style>