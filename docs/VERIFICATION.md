# Local verification — 2026-10-05

The source baseline and selectively imported files are pinned in `FOUNDATION.md`. The original repository remains unchanged. The physical Atlas was visually inspected in a 1366px production screenshot; terrain, relief, rivers and regional lettering remain intact.

| Check | Result |
| --- | --- |
| Clean root install, one workspace lockfile | Passed; Node 24.19.0 / npm 12.2.0 |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 170 retained presentation/accessibility warnings |
| `npm test` | Passed: 219 tests in 30 files, including backup/schema and Cloudflare cache contracts |
| `npm run test:pipeline` | Passed: 45 tests, 0 skipped; frozen canonical ZIP supplied locally |
| `npm run build` | Passed; 158 PWA precache entries, approximately 8.23 MiB |
| Browser shell smoke | Passed: 36 checks; 390/1366px, light/dark |
| Atlas cold starts | Passed: 6 checks; phone/desktop, reload and return from News |
| Label/marker paint order | Passed: 90 checks; 1920/1366/390px, light/dark, India/World, moving/settled |
| Atlas interaction | Passed: 21 checks; pan/zoom, selection, search, inspector and responsive layout |
| Canonical question/browser/offline checks | Passed: 104 light + 104 dark checks; all supported question representations and unvisited offline pack |
| News/browser/cache/offline checks | Passed: 256 checks; 375/1366px, light/dark, Read/Saved, archive, refresh, navigation and owned feed cache |
| Recall integration | Passed; exactly one saved attempt, Familiar mastery after reload, +1 XP, next-day review, no console errors |
| Capacitor sync | Passed for Android/iOS/web; all 5 retained platform plugins |
| Source fidelity | 8 physical sheet/overlay/raster hashes unchanged; all 2,273 place records and 149 question/answer records unchanged |
| SoI provenance | Official archive SHA matched; reimport matched 256 lines / 31,905 points to within 2.85e-14 degrees |
| Legacy text audit | 642 occurrences (406 repository, 236 built output), zero unexplained; each exact match is recorded with a reason by `tools/audit-foundation.mjs` |

Tests used the production build and local stock Chrome. Deliberate News failure/offline fixtures generate expected 503 and disconnected-resource diagnostics; there were no uncaught page errors. The separate recall integration uses the development module boundary so it can derive the real answer rather than inventing one.

The official outline and its provenance are separate bundled assets; this migration does not substitute their outline for the original physical map. The build independently validates geometry/provenance and inventories 113 Atlas/PYQ assets. The offline places-only rebuild reported zero unmatched, ambiguous or invalid PYQ ledger entries; the 25 authored-coordinate warnings preserve the existing sourced data.

The fresh dependency audit reports 9 existing advisories (5 moderate, 4 high), all in the native CLI or offline geodata toolchain (`@capacitor/cli` / `mapshaper` and their dependencies). These tools are outside the web app and Pages gateway bundles. No forced major upgrade was applied. Optional SQLite/MessagePack installation scripts are blocked by this host's npm policy; the required map builds, SoI reprojection, tests and native sync pass without them.

Cloudflare configuration and the adapter's GET/method/partial-failure/redirect/cache contracts are verified locally. No Cloudflare deployment or live publisher availability was tested in this migration. Android/iOS SDK builds, signing and physical-device interaction are not claimed. The new Git repository has no remote and contains no source PDFs or canonical source ZIP.
