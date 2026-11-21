<template>
  <article class="imperial-card">
    <h3 class="title">{{ system.name }}</h3>
    <div class="content">
      <p>{{ system.description }}</p>
      <div class="status" :class="system.status">{{ system.status }}</div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  system: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.imperial-card {
  background: #1a1a1a;
  border: 1px solid #9a0000;
  padding: 1.5rem;
  position: relative;
  transition: transform 0.3s;
}

.imperial-card:hover {
  transform: translateY(-5px);
}

.title {
  color: #9a0000;
  font-family: 'Uncial Antiqua', cursive;
  margin-bottom: 1rem;
}

.status {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.3rem 0.7rem;
  background: #2a2a2a;
  border: 1px solid #444;
}
</style>