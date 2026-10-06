# Foundation rules

- Atlas, News and Settings are the current product. Preserve the bundled physical cartography and baseline interaction unless the owner explicitly authorizes changes.
- Maintain stable place/question IDs, factual text, source citations and all four installed-app identifiers documented in README.
- Generated data comes from `tools/atlas-build`; change inputs and rebuild, then verify source fidelity. Never invent coordinates, facts, exam years or answers.
- `src/data/compatibility` is a storage boundary. Historical rows are opaque and must survive boot and backup round-trips. Do not erase stores or silently migrate personal content.
- News stores feed metadata only. The reader fetches one listed publisher's article when its headline is opened (`/api/article`, policy in `src/current-affairs/reader/policy.ts`), for the signed-in reader, and keeps it in memory for that visit. Never fetch articles in bulk or ahead of time; never store, cache or sync article text; never fetch a restricted publisher or work around a paywall or a publisher's refusal; never show a partial article as complete.
- Run root typecheck, lint, tests, pipeline tests, build and relevant browser checks. Keep verification claims limited to evidence collected.
- Publication and remote creation require explicit owner authorization.
