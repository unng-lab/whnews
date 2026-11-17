import { catalog, updateCatalog } from '~/utils/data';
import { createCatalogRefresh } from '~/utils/live-catalog.mjs';

export default defineNuxtPlugin((nuxtApp) => {
  const base = useRuntimeConfig().app.baseURL.replace(/\/$/, '');
  const refresh = createCatalogRefresh({ url: `${base}/chronicles.json`, initial: catalog, apply: updateCatalog });
  const check = () => { if (!document.hidden) void refresh.refresh(); };
  let timer;
  const stop = () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('online', check);
    refresh.dispose();
  };
  nuxtApp.hook('app:mounted', () => {
    check();
    timer = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
  });
  nuxtApp.vueApp.onUnmount(stop);
  if (import.meta.hot) import.meta.hot.dispose(stop);
});
