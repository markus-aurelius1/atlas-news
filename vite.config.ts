/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import currentAffairs from './tools/news/server.ts'

// BASE lets the PWA be hosted from a sub-path (e.g. GitHub Pages). Capacitor uses '/'.
const base = process.env.BASE ?? '/'

// Absolute URL of the production site, for canonical / Open Graph / Twitter tags.
// SITE_URL sets production canonical metadata.
const siteUrl = (
  process.env.SITE_URL ??
  'http://localhost:5173'
).replace(/\/+$/, '')

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    { name: 'current-affairs-gateway', configureServer(server) { server.middlewares.use('/api/current-affairs', currentAffairs) }, configurePreviewServer(server) { server.middlewares.use('/api/current-affairs', currentAffairs) } },
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
    {
      // The UI font is needed for the very first text: preload it, so nothing reflows when it arrives and the Atlas measures its names once.
      name: 'preload-ui-font',
      transformIndexHtml: {
        order: 'post',
        handler(_html, ctx) {
          const font = Object.keys(ctx.bundle ?? {}).find((name) => /manrope-latin-wght-normal[^/]*\.woff2$/.test(name))
          return font ? [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: base + font, crossorigin: '' }, injectTo: 'head' }] : []
        },
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // og-image.png is a social preview: crawlers fetch it, the installed app never does, so it is not precached.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        // The manifest id is the installed app's identity. It predates the rename to
        // Tars and must stay, or browsers would treat Tars as a different app and
        // existing installs would never pick up the new name and icons.
        id: 'lodestar-study',
        name: 'Tars — Atlas & News',
        short_name: 'Tars',
        description: 'An offline Atlas and a source-linked Current Affairs reading workspace.',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        // Night's stage colour (--bg in index.css): the splash a launched app fades in from.
        background_color: '#111215',
        theme_color: '#111215',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Atlas', url: './#/atlas' },
          { name: 'News', url: './#/current-affairs' },
        ],
      },
      workbox: {
        // The Atlas (sheets, relief plates, gazetteer) is precached so the map works offline from the first launch.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,json,geojson,webp}', 'atlas/**/*.txt'],
        globIgnores: ['**/og-image.png'],
        // The measured curated subset is <0.6 MiB: precache data for first-launch offline,
        // while application loading/validation stays paper-lazy. Hash queries select the same precached bytes.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^hash$/],
        runtimeCaching: [
          { urlPattern: /\/pyq-atlas\/v1\/manifest\.json$/, handler: 'NetworkFirst', options: { cacheName: 'atlas-pyq-manifest-v1', networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } } },
          { urlPattern: /\/pyq-atlas\/v1\/(?:papers\/|answers\/|place-pyq-index\.json)/, handler: 'CacheFirst', options: { cacheName: 'atlas-pyq-packs-v1', cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 160 } } },
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache well across app updates.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](dexie|zustand)[\\/]/ },
            { name: 'native', test: /node_modules[\\/]@capacitor/ },
          ],
        },
      },
    },
  },
  test: {
    // Logic tests run in node. Component tests (*.test.tsx) opt into a DOM with a `@vitest-environment happy-dom` docblock.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tools/cloudflare/*.test.ts'],
  },
})
