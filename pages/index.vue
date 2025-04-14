<template>
  <div class="max-w-screen-xl mx-auto p-6 space-y-16">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <NewsList :news="latestNews" :page="currentNewsPage" :totalPages="newsPages" @update:page="currentNewsPage = $event" />
      <LeadersList :leaders="leaders" @prev="prevLeaderPage" @next="nextLeaderPage" />
    </div>

    <!-- Worlds -->
    <section>
      <h2 class="text-3xl font-bold mb-4 border-b border-white/10 pb-2">Worlds</h2>
      <ul class="grid md:grid-cols-3 gap-6">
        <li v-for="world in paginatedWorlds" :key="world.name" class="bg-white/5 p-4 rounded-xl shadow">
          <h3 class="font-semibold text-lg">{{ world.name }}</h3>
          <p class="text-white/70 text-sm">{{ world.description }}</p>
        </li>
      </ul>
      <div class="flex justify-center mt-6 space-x-4">
        <button @click="currentWorldPage = Math.max(1, currentWorldPage - 1)" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&lt;</button>
        <button @click="currentWorldPage = Math.min(worldPages, currentWorldPage + 1)" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30">&gt;</button>
      </div>
    </section>

    <!-- Systems and Segmentums -->
    <section class="grid md:grid-cols-2 gap-12">
      <div>
        <h2 class="text-3xl font-bold mb-4 border-b border-white/10 pb-2">Systems</h2>
        <ul class="space-y-4">
          <li v-for="system in systems" :key="system.name">
            <h3 class="font-semibold text-lg">{{ system.name }}</h3>
            <p class="text-white/70 text-sm">{{ system.description }}</p>
          </li>
        </ul>
      </div>
      <div>
        <h2 class="text-3xl font-bold mb-4 border-b border-white/10 pb-2">Segmentums</h2>
        <ul class="space-y-4">
          <li v-for="seg in segmentums" :key="seg.name">
            <h3 class="font-semibold text-lg">{{ seg.name }}</h3>
            <p class="text-white/70 text-sm">{{ seg.description }}</p>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import NewsList from '@/components/NewsList.vue';
import LeadersList from '@/components/LeadersList.vue';
const pageSize = 10;
const currentNewsPage = ref(1);
const currentLeaderPage = ref(1);
const currentWorldPage = ref(1);

const latestNews = Array.from({ length: 100 }, (_, i) => ({
  title: `News Headline ${i + 1}`,
  description: `Description for news ${i + 1}`
}));

const leaders = ref([]);

const loadLeaders = async (page) => {
  const res = await fetch(`/leaders/page-${page}.json`);
  const data = await res.json();
  leaders.value = data;
};

const prevLeaderPage = () => {
  if (currentLeaderPage.value > 1) {
    currentLeaderPage.value--;
    loadLeaders(currentLeaderPage.value);
  }
};

const nextLeaderPage = () => {
  if (currentLeaderPage.value < 10) {
    currentLeaderPage.value++;
    loadLeaders(currentLeaderPage.value);
  }
};

onMounted(() => {
  loadLeaders(currentLeaderPage.value);
});

const worlds = Array.from({ length: 100 }, (_, i) => ({
  name: `World ${i + 1}`,
  description: `Description of world ${i + 1}`
}));

const systems = [
  { name: 'Cadia', description: 'Forrier fyitress world defending the Gadian Gate, now lying in ruins.' },
  { name: 'Rynn’s World', description: 'Home to the Crimson Fists, known for withstanding Ork invasions.' },
  { name: 'Armageddon', description: 'Desolate homeworld of Haad Angels ravaged by war and radiation.' }
];

const segmentums = [
  { name: 'Solar', description: 'Core region of space contacting body Forca and mest important worlds.' },
  { name: 'Segmentum Temprstus', description: 'Soutbesncuast segmentum. Rlouns for Cïrw Sulant and dangerous Space.' },
  { name: 'Segmentum Pacificus', description: 'Western segmentum, often planred by nams fusets ald heretical Insovernents.' }
];

const paginatedWorlds = computed(() => worlds.slice((currentWorldPage.value - 1) * pageSize, currentWorldPage.value * pageSize));
const newsPages = computed(() => Math.ceil(latestNews.length / pageSize));
const worldPages = computed(() => Math.ceil(worlds.length / pageSize));
</script>

<style scoped>
</style>
