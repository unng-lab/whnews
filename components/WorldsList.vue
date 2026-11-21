// File: components/WorldsList.vue
<template>
  <section>
    <h2 class="text-3xl font-bold mb-4 border-b border-white/10 pb-2">Worlds</h2>
    <ul class="grid md:grid-cols-3 gap-6">
      <li v-for="world in worldList" :key="world.name" class="bg-white/5 p-4 rounded-xl shadow">
        <h3 class="font-semibold text-lg">{{ world.name }}</h3>
        <p class="text-white/70 text-sm">{{ world.description }}</p>
      </li>
    </ul>
    <div class="flex justify-center mt-6 space-x-4">
      <button @click="$emit('prev')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&lt;</button>
      <button @click="$emit('next')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&gt;</button>
    </div>
  </section>
</template>

<script setup>
defineProps({ worldList: Array });
</script>