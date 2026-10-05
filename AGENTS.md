# Foundation rules

- Atlas, News and Settings are the current product. Preserve the bundled physical cartography and baseline interaction unless the owner explicitly authorizes changes.
- Maintain stable place/question IDs, factual text, source citations and all four installed-app identifiers documented in README.
- Generated data comes from `tools/atlas-build`; change inputs and rebuild, then verify source fidelity. Never invent coordinates, facts, exam years or answers.
- `src/data/compatibility` is a storage boundary. Historical rows are opaque and must survive boot and backup round-trips. Do not erase stores or silently migrate personal content.
- News links to publishers and stores feed metadata only. Do not scrape or host article bodies.
- Run root typecheck, lint, tests, pipeline tests, build and relevant browser checks. Keep verification claims limited to evidence collected.
- Publication and remote creation require explicit owner authorization.
