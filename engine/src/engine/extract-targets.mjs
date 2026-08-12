import { uniqueSelectors } from "../shared/selector.mjs";

export const SUPPORTED_RULES = Object.freeze([
  "link-name",
  "button-name",
  "scrollable-region-focusable",
]);

export function extractTargets(
  axeResult,
  supportedRules = SUPPORTED_RULES,
) {
  const allowed = new Set(supportedRules);
  const targets = {};

  for (const violation of axeResult?.violations ?? []) {
    if (!allowed.has(violation.id)) continue;

    targets[violation.id] = {
      ruleId: violation.id,
      impact: violation.impact,
      selectors: uniqueSelectors(violation.nodes),
      unsupportedTargets: violation.nodes.filter(
        (node) => !Array.isArray(node.target) || node.target.length !== 1,
      ).length,
    };
  }

  return targets;
}
