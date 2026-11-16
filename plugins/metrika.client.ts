type Metrika = {
  (...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: Metrika;
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  // Keep development and preview visits out of the production counter.
  if (!['lifeisbetter.ru', 'www.lifeisbetter.ru'].includes(window.location.hostname)) return;

  const counterId = 114286193;
  const ym: Metrika = window.ym ?? function (...args: unknown[]) {
    (ym.a ??= []).push(args);
  };
  window.ym = ym;
  ym.l = Date.now();

  ym(counterId, 'init', {
    defer: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
  document.head.appendChild(script);

  let previousUrl = document.referrer;
  let lastUrl = '';
  const trackPage = () => {
    const url = window.location.href;
    if (url === lastUrl) return;
    ym(counterId, 'hit', url, { referer: previousUrl, title: document.title });
    lastUrl = url;
    previousUrl = url;
  };

  onNuxtReady(trackPage);
  nuxtApp.hook('page:finish', trackPage);
});
