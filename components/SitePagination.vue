<script setup>
import { pageHref, pageNumbers } from '~/utils/catalog.mjs';
const props = defineProps({ page: { type: Object, required: true }, base: { type: String, required: true }, label: { type: String, default: 'Страницы' }, interactive: Boolean });
const emit = defineEmits(['change']);
const numbers = computed(() => pageNumbers(props.page.totalPages, props.page.page));
</script>

<template>
  <nav v-if="page.totalPages > 1" class="pagination" :aria-label="label">
    <template v-for="(number, index) in [page.previous, ...numbers, page.next]" :key="index">
      <span v-if="number === null" class="pagination-muted" :aria-disabled="index === 0 || index === numbers.length + 1 ? 'true' : undefined">
        {{ index === 0 ? '← Назад' : index === numbers.length + 1 ? 'Далее →' : '…' }}
      </span>
      <button v-else-if="interactive" type="button" :aria-current="number === page.page && index > 0 && index <= numbers.length ? 'page' : undefined" @click="emit('change', number)">
        {{ index === 0 ? '← Назад' : index === numbers.length + 1 ? 'Далее →' : number }}
      </button>
      <NuxtLink v-else :to="pageHref(base, number)" :aria-current="number === page.page && index > 0 && index <= numbers.length ? 'page' : undefined">
        {{ index === 0 ? '← Назад' : index === numbers.length + 1 ? 'Далее →' : number }}
      </NuxtLink>
    </template>
  </nav>
</template>
