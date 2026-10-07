/** Latest owner amendment. Evaluation policy only; production does not import this module. */
export const EDITORIAL_POLICY = {
  version:'tars-upsc-editorial-evaluation/2', maxTodayUnits:50, precisionCutoffs:[20,50], fillTarget:null,
  historyDays:14, strongRepeatComparisonDays:7, automaticFreshnessReset:false,
  visibleRepresentativesPerEquivalentDevelopment:1,
  archiveMeaning:'historical_editorially_selected_reading_units_only',
  preferredComparablePublishers:['The Hindu','Indian Express'],
  explicitlyNamedCorePublishers:['The Hindu','Indian Express','Times of India','Economic Times'],
  otherCoreSources:'established high-quality sources verified in registry; explicitly declare additional core names for publisher-policy evaluation',
  secondaryJustifications:['unique','high_substantive_confidence','materially_superior'],
  tribunePolicy:'no ban/quota; equivalent coverage loses to comparable core; unique/superior reporting can win',
  representativeCriteria:['substantive_completeness','explanatory_usefulness','directness','comparable_TH_IE_preference','trusted_source_quality','recency_late_tiebreaker'],
  sourceVolumeRelevancePoints:0, duplicateExposureDirection:'approach_zero', repeatExposureDirection:'approach_zero',
  optimization:'smallest high-quality set covering important UPSC reading needs; ceiling never fill target',
} as const
