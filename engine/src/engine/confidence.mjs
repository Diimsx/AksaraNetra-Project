export const DEFAULT_CONFIDENCE_POLICY = Object.freeze({
  applyThreshold: 0.8,
  reviewThreshold: 0.6,
});

export function classifyConfidence(
  confidence,
  policy = DEFAULT_CONFIDENCE_POLICY,
) {
  if (confidence >= policy.applyThreshold) return "apply";
  if (confidence >= policy.reviewThreshold) return "review";
  return "skip";
}
