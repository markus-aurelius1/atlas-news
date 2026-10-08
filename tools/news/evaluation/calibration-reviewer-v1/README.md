# Frozen calibration reviewer infrastructure v1

This directory preserves the exact previously generated 50-item calibration manifest and provenance. It is an enriched owner-calibration selection, not a release holdout. Base commit: c95d63b9740f0cc9aad756dd6a88684d499bf6c6.

calibration-manifest.json and its SHA-256 companion are copied verbatim from the existing ignored reviewer-calibration-50 package. artifact-hashes.json is that original package's inventory; its paths are relative to the original generated package, not this metadata directory. reviewer-README.md preserves the blind-review instructions. slice-coverage.md records neutral overlapping selection coverage. commit-validation.json records the fresh pre-commit audit.

The 50 selected article IDs, order, seed, capture cutoff, selection trace, original corpus/artifact hashes, rubric file hash and tool source hashes remain unchanged. No annotation responses, gold labels, comparison outputs, raw captures, corpus records, reviewer HTML, screenshots or temporary artifacts are included here. The original packaged reviewer retains 50 empty annotations.

Reproduce the reviewer assets into a NEW ignored local directory with:

    node tools/news/evaluation/calibration-package.ts FROZEN_A2A_PACKAGE tools/news/evaluation/data/NEW_CALIBRATION_CHILD

Supply the frozen local package identified by the manifest and verify the resulting ordered articleIds against this manifest. Never overwrite the original package. Existing reviewer reports describe the earlier uncommitted QA state; this directory freezes their infrastructure and metadata in the subsequently authorized local commit. No human-annotation import or Stage C work is part of this commit.
