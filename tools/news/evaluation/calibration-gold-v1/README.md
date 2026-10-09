# Frozen owner-validated calibration gold v1

Owner calibration set — not statistical release evaluation. All 50 original annotations and their authorship are preserved. owner-attestation.json separately binds owner validation to exact input bytes and IDs. gold.json is a versioned envelope: record preserves A1 compatibility; model-origin resolved records remain in_review in that inner record because the single-human policy cannot name the model as the human adjudicator. resolvedGold plus separate owner validation is authoritative for this calibration only. Unresolvable resolvedGold is null; inner gold stays blank. Do not feed this envelope to the generic A1 evaluator as a release corpus.

SHA-256 manifest covers all package files except itself and its companion; the companion pins the manifest hash. Verify before use. No original input is overwritten. Reruns must target a new directory. Parent/input/tool hashes, provenance and exact baseline replay evidence are in provenance.json. Comparison uses unchanged frozen predictions, not new predictions.

Read COMPARISON.md, ERROR_CASES.md and STAGE_C_REQUIREMENTS.md; JSON and TSV retain full machine-readable results. Verification of repository checks is stored separately in ../CALIBRATION_GOLD_VERIFICATION.json. No Stage C/D/E/F implementation, production edit, commit, push, merge or deployment is authorized by this package.
