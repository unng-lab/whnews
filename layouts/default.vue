<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Перейти к содержанию</a>
    <header class="masthead"><div class="masthead-top"><span>Художественная сатира</span><span>Протоколы далёкого будущего</span></div><NuxtLink to="/" class="wordmark" aria-label="WHNEWS — главная"><span>WH</span>NEWS<span class="wordmark-star" aria-hidden="true">✦</span></NuxtLink><p class="masthead-caption">Хроники · Личные дела · Далёкие миры</p><nav class="main-nav" aria-label="Главная навигация"><NuxtLink to="/">Хроники</NuxtLink><NuxtLink to="/actors/">Действующие лица</NuxtLink><NuxtLink to="/worlds/">Миры</NuxtLink><NuxtLink to="/systems/">Системы</NuxtLink></nav></header>
    <RadioPlayer />
    <main id="main-content" class="site-main"><slot /></main>
    <footer class="site-footer"><div><NuxtLink to="/" class="footer-brand">WHNEWS</NuxtLink><p>Реальный мир — в вымышленных летописях.</p></div><p>Фанатский сатирический проект. Персонажи, их образы и хроники — художественный вымысел. Не является официальным проектом Warhammer или RT.</p><NuxtLink to="/news/">Архив хроник ↗</NuxtLink></footer>
  </div>
</template>

<script setup>
</script>

<style scoped>
</style>
