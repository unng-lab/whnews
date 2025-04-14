<template>
  <div class="max-w-screen-xl mx-auto p-6 space-y-16">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <NewsList :newsList="news" @prev="prevNewsPage" @next="nextNewsPage" />
      <LeadersList :leaders="leaders" @prev="prevLeaderPage" @next="nextLeaderPage" />
    </div>

    <!-- Worlds -->
    <WorldsList :worldList="worlds" @prev="prevWorldPage" @next="nextWorldPage" />

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
import WorldsList from '@/components/WorldsList.vue';

const currentNewsPage = ref(1);
const currentLeaderPage = ref(1);
const currentWorldPage = ref(1);

const news = ref([]);
const leaders = ref([]);
const worlds = ref([]);

const loadNews = async (page) => {
  const res = await fetch(`/news/page-${page}.json`);
  news.value = await res.json();
};

const loadLeaders = async (page) => {
  const res = await fetch(`/leaders/page-${page}.json`);
  leaders.value = await res.json();
};

const loadWorlds = async (page) => {
  const res = await fetch(`/worlds/page-${page}.json`);
  worlds.value = await res.json();
};

const prevNewsPage = () => {
  if (currentNewsPage.value > 1) {
    currentNewsPage.value--;
    loadNews(currentNewsPage.value);
  }
};
const nextNewsPage = () => {
  currentNewsPage.value++;
  loadNews(currentNewsPage.value);
};

const prevLeaderPage = () => {
  if (currentLeaderPage.value > 1) {
    currentLeaderPage.value--;
    loadLeaders(currentLeaderPage.value);
  }
};
const nextLeaderPage = () => {
  currentLeaderPage.value++;
  loadLeaders(currentLeaderPage.value);
};

const prevWorldPage = () => {
  if (currentWorldPage.value > 1) {
    currentWorldPage.value--;
    loadWorlds(currentWorldPage.value);
  }
};
const nextWorldPage = () => {
  currentWorldPage.value++;
  loadWorlds(currentWorldPage.value);
};

onMounted(() => {
  loadNews(currentNewsPage.value);
  loadLeaders(currentLeaderPage.value);
  loadWorlds(currentWorldPage.value);
});

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
</script>

<style scoped>
</style>
