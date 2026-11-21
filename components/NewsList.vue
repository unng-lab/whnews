<template>
  <section class="lg:col-span-1 pr-2 border-r border-white/10">
    <h2 class="text-4xl font-bold mb-6 border-b border-white/10 pb-2">Latest News</h2>
    <div class="space-y-6">
      <div
          v-for="(news, index) in newsList"
          :key="index"
          class="rounded-xl p-4 bg-white/5 shadow-lg space-y-2"
      >
        <div class="text-sm text-white/50">{{ formatDate(news.date) }}</div>
        <p class="text-white/80 text-sm leading-relaxed whitespace-pre-line">
          {{ news.text }}
        </p>
      </div>
    </div>
    <div class="flex justify-center mt-4 space-x-4">
      <button @click="$emit('prev')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&lt;</button>
      <button @click="$emit('next')" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&gt;</button>
    </div>
  </section>
</template>

<script setup>
defineProps({ newsList: Array });

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
</script>
