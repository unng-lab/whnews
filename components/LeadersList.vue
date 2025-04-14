<template>
  <section class="lg:col-span-2">
    <h2 class="text-4xl font-bold mb-6 border-b border-white/10 pb-2">Leaders</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div v-for="leader in leaders" :key="leader.name" class="bg-white/5 p-4 rounded-xl shadow text-center">
        <img :src="leader.image" :alt="leader.name" class="rounded-xl w-full h-48 object-cover mb-4" />
        <h3 class="text-lg font-semibold">{{ leader.name }}</h3>
        <p class="text-white/70 text-sm">{{ leader.description }}</p>
      </div>
    </div>
    <div class="flex justify-center mt-6 space-x-4">
      <button @click="$emit('prev')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&lt;</button>
      <button @click="$emit('next')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&gt;</button>
    </div>
  </section>
</template>

<script setup>
defineProps({ leaders: Array });
</script>
