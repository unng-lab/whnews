<template>
  <div class="min-h-screen flex flex-col bg-black text-white font-serif">
    <!-- Header -->
    <header class="bg-white/5 py-4 shadow-md">
      <div class="max-w-screen-xl mx-auto px-6 text-center">
        <h1 class="text-3xl font-bold tracking-wide uppercase">LiveIsBetter</h1>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <footer class="bg-white/5 py-4 mt-12 text-center text-white/70 text-sm border-t border-white/10">
      <p>&copy; 2025 LiveIsBetter - Fan Project. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
</script>

<style scoped>
</style>