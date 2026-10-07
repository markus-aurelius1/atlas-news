# Validator v3 — Job B: Source and Author Intelligence

Local implementation only, 2026-10-07. Branch codex/validator-v3-b starts at completed A1 commit a4bd096. The original feature/pyq-corpus-2.2.0 checkout was read only. The implementation handoff below was recorded before committing. The owner subsequently authorized one local Job B commit after final scope review; no push, merge, remote creation or deployment is authorized. A2/C–F remain unstarted.

## Coverage findings

The acquisition gap was real: the A1 registry did not include IE Columns, UPSC Essentials, the three specialist Explained feeds or TH Opinion/Columns/Op-ed/Lead. IE editorials and TH editorials are separate from signed columns; an editorial-only feed cannot cover them. TH Science and Environment already enter raw feeds and retain descriptions/categories. IE Explained Global/Columns and TH Lead/Op-ed provide additional IR/Security analytical acquisition paths; Economy is covered by existing Economy feeds plus Explained Economics. No author assigns those articles a subject or eligibility. No dedicated Security endpoint was guessed.

The final two-pass audit contains 9846 raw observations and 4533 unique URLs across 75/86 sources in 13/15 publisher-relevant shards. All 23 IE/TH endpoints succeeded twice with HTTP 200. The unprobed sources are explicitly listed in JOB_B_EVIDENCE.json; absence of a probe is not zero supply. Each shard has <=6 upstream requests, a 15-second budget, 10-second source timeout, 4 MiB XML bound, redirects refused and credentials omitted. Listing pages are fetched separately, one at a time, under the same timeout/size/refusal bounds. No article page/body was fetched for this research; no page HTML or feed full-content fields were saved.

On the SAME final captures, the 66 sampled legacy sources supplied 3582 unique URLs; the nine additions supplied 951 additional URLs (104 published within the preceding seven days). This is acquisition/backfill, not valuable-article recall, Today recall or classifier improvement. It is conditional on the sampled shards, not a complete census of the old registry. Initial A1-format research also probed every legacy shard before additions. Repeated probes here span minutes, not a longitudinal uptime study.

| Source | Unique URLs | Last 7 days | Description present | Categories present | Bylines present | Newest UTC | Probe success |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| ie-upsc | 200 | 29 | 0 | 200 | 179 | 2026-10-07T08:30:08.000Z | 2/2 |
| ie-explained | 200 | 50 | 0 | 200 | 167 | 2026-10-07T11:54:48.000Z | 2/2 |
| ie-economy | 200 | 2 | 0 | 200 | 183 | 2026-10-04T15:38:00.000Z | 2/2 |
| ie-india | 200 | 170 | 0 | 200 | 164 | 2026-10-07T10:50:56.000Z | 2/2 |
| ie-world | 200 | 84 | 0 | 200 | 69 | 2026-10-07T09:57:18.000Z | 2/2 |
| ie-governance | 86 | 0 | 0 | 86 | 86 | 2023-02-02T15:32:54.000Z | 2/2 |
| ie-editorial | 200 | 17 | 0 | 200 | 1 | 2026-10-07T00:45:58.000Z | 2/2 |
| hindu-national | 60 | 60 | 53 | 60 | 0 | 2026-10-07T12:55:04.000Z | 2/2 |
| hindu-world | 60 | 60 | 59 | 60 | 0 | 2026-10-07T09:57:18.000Z | 2/2 |
| hindu-economy | 60 | 40 | 58 | 60 | 0 | 2026-10-07T12:14:28.000Z | 2/2 |
| hindu-science | 60 | 41 | 58 | 60 | 0 | 2026-10-07T11:06:53.000Z | 2/2 |
| hindu-environment | 60 | 30 | 58 | 60 | 0 | 2026-10-07T09:08:24.000Z | 2/2 |
| hindu-editorial | 60 | 14 | 60 | 60 | 0 | 2026-10-07T03:54:47.000Z | 2/2 |
| ie-columns | 200 | 55 | 0 | 200 | 178 | 2026-10-07T10:03:04.000Z | 2/2 |
| ie-upsc-essentials | 200 | 23 | 0 | 200 | 173 | 2026-10-07T08:30:08.000Z | 2/2 |
| ie-explained-science | 200 | 7 | 0 | 200 | 166 | 2026-10-07T11:54:48.000Z | 2/2 |
| ie-explained-global | 200 | 9 | 0 | 200 | 146 | 2026-10-06T14:26:50.000Z | 2/2 |
| ie-explained-economics | 200 | 7 | 0 | 200 | 195 | 2026-10-07T08:46:02.000Z | 2/2 |
| hindu-opinion | 60 | 60 | 46 | 60 | 0 | 2026-10-07T08:37:35.000Z | 2/2 |
| hindu-columns | 60 | 1 | 60 | 60 | 0 | 2026-10-02T07:42:51.000Z | 2/2 |
| hindu-op-ed | 60 | 24 | 54 | 60 | 0 | 2026-10-07T06:38:12.000Z | 2/2 |
| hindu-lead | 60 | 8 | 59 | 60 | 0 | 2026-10-07T05:23:05.000Z | 2/2 |

## Verified feed changes

Publisher provenance: [IE RSS directory](https://indianexpress.com/rss-2/) lists every new IE endpoint verbatim. [TH RSS directory](https://www.thehindu.com/rssfeeds/) was discovered through the publisher homepage and lists every new TH endpoint. The web research tool refused TH by robots policy; the permitted publisher directory and RSS endpoints answered direct bounded requests. No alternate host, proxy, redirect workaround or paywall bypass was used. Initial candidates and enabled feeds each passed two probes with useful incremental URLs. Incremental counts below overlap; do not sum them.

| Added source | Verified endpoint | URLs outside sampled legacy feeds |
| --- | --- | ---: |
| ie-columns | https://indianexpress.com/section/opinion/columns/feed/ | 200 |
| ie-upsc-essentials | https://indianexpress.com/section/upsc-current-affairs/upsc-essentials/feed/ | 43 |
| ie-explained-science | https://indianexpress.com/section/explained/explained-sci-tech/feed/ | 189 |
| ie-explained-global | https://indianexpress.com/section/explained/explained-global/feed/ | 166 |
| ie-explained-economics | https://indianexpress.com/section/explained/explained-economics/feed/ | 157 |
| hindu-opinion | https://www.thehindu.com/opinion/feeder/default.rss | 44 |
| hindu-columns | https://www.thehindu.com/opinion/columns/feeder/default.rss | 60 |
| hindu-op-ed | https://www.thehindu.com/opinion/op-ed/feeder/default.rss | 56 |
| hindu-lead | https://www.thehindu.com/opinion/lead/feeder/default.rss | 60 |

Registry: 77 -> 86, below the 99-source cap; 13 legacy shards -> 15 current shards, never more than six feeds per invocation. No feeds removed. The separately published IE technology/science feed answered twice (200 entries, 200 outside initial baseline) but newest publication was 2026-09-24T03:11:14.000Z: held for freshness/maintenance review. Fresh Explained Sci-Tech is enabled instead. Existing IE Governance is dormant (newest 2023-02-02), retained explicitly; a 200 response is not fresh coverage.

## Requested authors and unresolved discovery

[PB Mehta profile](https://indianexpress.com/profile/columnist/pratap-bhanu-mehta/) and [C. Raja Mohan profile](https://indianexpress.com/profile/author/c-raja-mohan/) verify canonical names, publisher binding and the small alias sets. The registry contains exactly two active, reviewed/versioned identities. PB Mehta: 3 unique articles, all in ie-columns. C. Raja Mohan: 5 unique articles, 4 via ie-columns and one via ie-explained-global. All eight are identified through publisher-supplied rss:dc:creator; all lack descriptions. The baseline IE/TH feeds contained none of these eight byline-identified URLs.

Each profile's first listing page contained 25 attributed titles; 3 PB Mehta and 5 C. Raja Mohan URLs appeared in the captured feeds. Older titles, finite feed windows and PB Mehta's recent book review outside Columns explain part of that discovery mismatch; do not label all missing titles current valuable misses. Profile navigation/related links cannot establish attribution. Source memberships and matched field/provenance, rather than a headline name, support identity. No author acceptance, subject default, political/noise/foreign bypass or unknown-author penalty exists.

## Acquisition funnel and metadata ceiling

Bounded unreviewed listing inventory: 495 discovered -> 437 observed in raw -> 137 with a description. 58 were not observed; 300 observed entries lack descriptions. Independently judged metadata-sufficient and later-evaluable counts remain null/pending. Listing presence is not value gold, and description presence is not reliable judgement. No articles were accepted/rejected/labelled/split by B.

| Publisher | Unique URLs | Missing description | Missing byline | Nonempty description only repeats title |
| --- | ---: | ---: | ---: | ---: |
| Indian Express | 2041 | 2041 | 545 | 0 |
| The Hindu | 533 | 31 | 533 | 0 |

Across all sampled sources: 2267/4533 lack descriptions, 2260 lack bylines, 998 lack categories, zero lack publication time. Within the IE priority material, absent descriptions are the dominant observed metadata ceiling: adding feeds fixes acquisition but still leaves title/category/byline-only input, especially for all eight curated-author columns. Opaque purpose, India impact/global_systemic significance, quality and distinct angle cannot be certified from an author's reputation. B measures field availability; actual semantic sufficiency/recall ceilings need independent A2 review. No speculative lexical rules or article-fetch fallback were added.

Raw parsing losses: 2 invalid entries; 400 entries excluded by the existing 200-per-feed cap across both passes. Losses and source-specific clipping are in JOB_B_EVIDENCE.json. Parser does not fall back from missing description to content:encoded or Atom content. Missing TH bylines are upstream absence in these observations, not a parser-name inference opportunity. Final-pass non-focus failures: none. Earlier preserved job-b-2026-10-07 and job-b-2026-10-07-final captures each recorded two india-northeast-now timeouts (four failed requests total); the final verified captures succeeded. Those failures are not erased or counted as zero relevant supply. Failures remain separate from empty feeds and never become zero relevant supply.

## Metadata and compatibility contract

- NewsItem adds optional memberships [{sourceId,feedUrl,section}], categories [string], bylines [{name,provenance,sourceId}] and updatedAt. RSS dc:creator, RSS author, entry Atom author and explicit inherited Atom feed author are supported. Empty entry authors override inheritance; ambiguous combined names remain candidates, never guessed identities. An RSS email plus one explicit parenthesized name may match an exact curated alias. No substring matching.
- Bounds: title 400, description 600, URL 2048, <=99 memberships, <=30 categories of 160 chars, <=20 bylines of 160 chars. The same field allowlist applies at cache ingress, archive writes/restore and existing pinned metadata cleaners. Body/HTML/cookie/credential/unknown fields never enter new records. Old rows lacking new fields remain valid; no store version, personal identity, backup merge, sync/D1 or reader-policy migration.
- Same canonical URL merges deterministically without input mutation. Union observed valid memberships/categories/bylines, choose actual nonempty bounded strings without joining descriptions, use pinned registry precedence for the legacy primary source. Canonical URL remains personal identity. Conflicting actual revisions remain in raw observation references; merged application metadata is not a fabricated gold revision.
- Trust requires exact enabled registry source/feed/section/publisher binding and exact publisher site hostname (apex/www equivalent; credential/suffix/port spoofs fail). sourceIntelligence.verifiedPublisher and curatedAuthorEvidence are the verified evidence paths; a raw publisher display string alone is not authentication. Categories/sections do not assign subject or eligibility.
- Modern requests carry generation rss-de1aebaa; edge keys and pending collections include generation. Requests without generation use immutable A1 77-source/13-shard layout (rss-172539e2). Unknown generations return 409 without upstream fetches. Wrong-generation responses cannot replace a usable client snapshot. Retention uses successful SOURCE IDs/memberships, not numeric shard position, including individual source failures.
- tars-news-feed-v2 and its two-hour cache-first/navigation behavior are unchanged. A fresh legacy snapshot is used until ordinary expiry or explicit refresh; failed partial refresh keeps usable coverage. New feeds do not force a cache purge.

## A2/C handoff

Consume A1 tars-news-raw/v1 observations with source health and actual captured/published/updated times. Final parser version: tars-eval-metadata/3; registry SHA-256 de31011cab4b5ca22e130016aaaecd5d41e867ea7bea0a21b101dc9ba9bc9d21. Immutable final artifacts: data/job-b-2026-10-07-verified/ (registry, parser-manifest, raw shard objects, listing health/inventory, audit). They are local/ignored research metadata, not a gold corpus or holdout. JOB_B_EVIDENCE.json contains artifact SHA-256s, source table, overlaps via the raw audit, author/registry versions and the conditional ablation. Earlier research roots are preserved but superseded for final reporting; their extractor/parser generations must not be mixed.

validateRaw(capture, pinnedRegistry) verifies the supplied archived registry's digest and provenance. EvaluationContext.rawRegistries supplies immutable saved generations; unknown/mismatched registries fail rather than relabelling old observations. Raw network collection remains limited to verified current sources or their legacy subset. A2 must start its own authorized manifest/capture namespace, sampling and human reviews; none were started here. Keep gold metadata equal to one actual revision, and attach all source/revision observation IDs rather than fabricating joined prose. C can use observationItem for one raw revision, then sourceIntelligence/curatedAuthorEvidence with version commitments; missing metadata remains uncertainty. C alone owns eligibility, UPSC scope/global_systemic policy and relevance. Author identity supplies no pass, score, subject or rescue. No production thresholds, classifier, novelty, ranking or Today algorithm changed.

## Verification

| Command | Result |
| --- | --- |
| npm run test:source-intelligence | 27 passed (parser/identity/merging/bounds/archive/generation/TTL/Cloudflare fixtures) |
| npm run test:source-audit | 5 passed (synthetic funnel arithmetic, repeat weighting, archived registry, Atom and listing attribution) |
| npm run test:evaluation | 30 passed |
| npm run typecheck | Passed |
| npm run lint | Passed; 0 errors, 133 existing warnings |
| npm test | 604 passed in 41 files |
| npm run test:pipeline | 39 passed; 6 skipped because external canonical ZIP is absent |
| npm run build | Passed; 165 PWA precache entries; protected generated assets unchanged |
| npm run test:cloudflare | 35 passed in 5 files; mocks/local logic, not hosted workerd certification |
| node tools/browser/news-check.mjs | 276 passed, 375/1366 px and both themes; owned offline cache/503/TTL/Read/Saved/Archive survival; no page errors |
| node tools/browser/reader-check.mjs | 320 passed, four layouts; Back/focus, refusal actions and no article text persistence; local fixtures only |
| node tools/news/evaluation/source-audit-cli.ts capture tools/news/evaluation/data/job-b-2026-10-07-verified | Two final raw passes plus bounded publisher listings; evidence, not production certification |
| npx --no-install wrangler --version | Failed: missing local Wrangler package; did not install dependencies. workerd/D1 browser test:sync remains unverified |
| git diff --check | Passed |

Earlier build/typecheck attempts caught and corrected a literal type in a new cache-test fixture. Final tests/build passed. No authenticated production, real D1, physical-device, uptime, semantic-quality, labelled recall or release certification is claimed.

The implementation-stage changed files, git diff --stat and git status snapshot is in JOB_B_GIT.txt, captured after scratch cleanup and before the later commit authorization. Its intent-to-add/status output is historical; final committed state is verified with git show and git status. No protected Atlas/PYQ, Reader implementation, sync/D1, personal-state or installed identifiers were changed.

## Final local commit scope review

The owner authorized one local commit, Build Validator v3 source intelligence. Before staging, HEAD was exactly a4bd096 on codex/validator-v3-b, with no intervening commits or imported PYQ work. The complete diff was reviewed: acquisition, bounded optional metadata, source/author evidence, cache-generation compatibility, diagnostics, tests and documentation only. Production eligibility thresholds, subject classification, novelty/clustering, ranking/diversity and Today code remain identical to A1. No article-body validator input, speculative lexical rules, author acceptance or source bypass was introduced. Existing 77 source definitions remain intact; nine additions yield 86 sources and 15 shards of at most six feeds. Old cache/archive records without optional metadata remain supported. Raw research/cache/build artifacts remain ignored and excluded from the commit. No push, merge or deployment.
