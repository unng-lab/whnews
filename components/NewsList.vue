<template>
  <section class="lg:col-span-1 pr-2 border-r border-white/10">
    <h2 class="text-4xl font-bold mb-6 border-b border-white/10 pb-2">Latest News</h2>
    <div class="space-y-6">
      <div v-for="newsItem in paginatedNews" :key="newsItem.title" class="rounded-xl p-4 bg-white/5 shadow-lg">
        <h3 class="text-xl font-semibold mb-2">{{ newsItem.title }}</h3>
        <p class="text-white/80 text-sm">{{ newsItem.description }}</p>
      </div>
    </div>
    <div class="flex justify-center mt-4 space-x-4">
      <button @click="$emit('update:page', Math.max(1, page - 1))" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&lt;</button>
      <button @click="$emit('update:page', Math.min(totalPages, page + 1))" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&gt;</button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  news: Array,
  page: Number,
  totalPages: Number
});

const pageSize = 10;
const paginatedNews = computed(() =>
    props.news.slice((props.page - 1) * pageSize, props.page * pageSize)
);
</script>
