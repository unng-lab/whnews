// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from 'node:fs';
import { staticRoutes } from './utils/catalog.mjs';
const catalog = JSON.parse(readFileSync(new URL('./content/catalog.json', import.meta.url), 'utf8'));

export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: {enabled: false},
    app: { head: { htmlAttrs: { lang: 'ru' }, meta: [{ name: 'description', content: 'WHNEWS — художественные хроники далёкого будущего, действующие лица и их летописи.' }] } },
    nitro: { prerender: { routes: staticRoutes(catalog), failOnError: true } },
    css: ['~/assets/css/main.css'],
    vite: {
        plugins: [
            tailwindcss(),
        ],
    },
})
