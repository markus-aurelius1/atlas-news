# TARS

Local-first Atlas, publisher-linked News, and Settings. The bundled physical Atlas includes relief, hillshade, rivers, geographic overlays, 2,273 stable places and canonical geography PYQs. No online map provider is required.

Use Node 22 or newer. Install and verify from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:pipeline
npm run build
npm run test:browser
```

The lockfile includes the offline data builder and Playwright browser workspace. Before browser checks, install Chromium with `npx playwright-core install chromium`, or set `CHROMIUM_PATH` to a local Chrome/Chromium executable. `npm run dev` starts development; `npm run preview` serves the production build.

`npm run atlas:places` rebuilds the gazetteer offline from curated inputs and bundled overlays. `npm run atlas:pyq` verifies the frozen canonical package and rebuilds the curated subset; provide `CANONICAL_PYQ_PACKAGE` or the sibling `canonical-pyq-v2-final.zip`. Full cartographic regeneration (`npm run build --prefix tools/atlas-build`) uses cited upstream geographic sources and needs network access. Existing bundled plates do not need regeneration to build the app.

For Cloudflare Pages, set `SITE_URL` to the new site's HTTPS origin and use `node tools/cloudflare/build.mjs` as the build command, with `dist` as output. `wrangler.toml`, `public/_routes.json`, `public/_headers`, and `functions/api/current-affairs.ts` define deployment behavior. The gateway fetches only registry publishers, rejects redirects, and caches successful responses for two hours. News stores feed metadata and Read/Saved state offline; original publisher articles open externally.

Native source remains in `android` and `ios`. Run `npm run cap:sync` before opening a native project. Physical device builds and signing require their respective platform SDKs.

Keep `lodestar` (IndexedDB), `lodestar-study` (PWA), `app.lodestar.study` (native), and `lodestar://` (deep links). See [foundation provenance](docs/FOUNDATION.md) for source pins, compatibility boundaries, asset checks, and verification results. This is a local repository with no remote configured.
