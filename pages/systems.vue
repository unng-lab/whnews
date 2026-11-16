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
import systems from '~/public/content/systems.json';

useHead({
  title: 'Imperial Systems - Warhammer 40k Database'
})

</script>

<style>
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 1rem;
}
</style>
