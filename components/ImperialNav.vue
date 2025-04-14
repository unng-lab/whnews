<template>
  <nav class="imperial-nav">
    <NuxtLink to="/">Home</NuxtLink>
    <NuxtLink to="/news">Latest News</NuxtLink>
    <NuxtLink to="/systems">Systems</NuxtLink>
    <NuxtLink to="/worlds">Worlds</NuxtLink>
    <NuxtLink to="/characters">Characters</NuxtLink>
  </nav>
</template>

<style scoped>
.imperial-nav {
  background: #1d1d1d;
  padding: 1.5rem;
  display: flex;
  gap: 2rem;
  justify-content: center;
  border-bottom: 3px solid #9a0000;
}

.imperial-nav a {
  color: #e0e0e0;
  text-decoration: none;
  font-family: 'Uncial Antiqua', cursive;
  font-size: 1.2rem;
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  transition: all 0.3s;
}

.imperial-nav a:hover {
  border-color: #9a0000;
  background: rgba(154, 0, 0, 0.1);
}

.router-link-active {
  border-color: #9a0000 !important;
}
</style>