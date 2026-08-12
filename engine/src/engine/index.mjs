import AxeBuilder from "@axe-core/playwright";
import { extractTargets, SUPPORTED_RULES } from "./extract-targets.mjs";
import { DEFAULT_CONFIDENCE_POLICY } from "./confidence.mjs";
import { applyCandidates, rollbackPatches } from "./apply-patch.mjs";
import {
  createMetrics,
  createRegressionReport,
  findDuplicateLabels,
} from "./report.mjs";
import {
  applyVerifiedLabels,
  findStaleOverrides,
} from "./verified-labels.mjs";
import { resolveLinkNameCandidates } from "../rules/link-name.mjs";
import { resolveButtonNameCandidates } from "../rules/button-name.mjs";
import { resolveScrollableRegionCandidates } from "../rules/scrollable-region.mjs";
import { ENGINE_VERSION } from "../shared/version.mjs";

const resolvers = {
  "link-name": resolveLinkNameCandidates,
  "button-name": resolveButtonNameCandidates,
  "scrollable-region-focusable": resolveScrollableRegionCandidates,
};

async function runTargetedAxe(page, rules) {
  if (!rules.length) {
    return { violations: [], passes: [], incomplete: [], inapplicable: [] };
  }

  return new AxeBuilder({ page }).withRules(rules).analyze();
}

export async function remediatePage({
  page,
  axeResult,
  rules = SUPPORTED_RULES,
  confidencePolicy = DEFAULT_CONFIDENCE_POLICY,
  config = {},
  rollbackOnRegression = true,
}) {
  if (!page) throw new Error("remediatePage requires a Playwright page");
  if (!axeResult) throw new Error("remediatePage requires an axe result");

  const supportedRules = rules.filter((ruleId) => resolvers[ruleId]);

  // The caller's axe result may have been filtered by WCAG tags. Some rules,
  // such as scrollable-region-focusable, are best-practice rules and would be
  // absent from that result. Run an explicit targeted baseline so every
  // requested engine rule is measured before any patch is applied.
  const targetedBefore = await runTargetedAxe(page, supportedRules);
  const targets = extractTargets(targetedBefore, supportedRules);
  const resolved = [];

  for (const ruleId of supportedRules) {
    const selectors = targets[ruleId]?.selectors ?? [];
    resolved.push(...(await resolvers[ruleId](page, selectors, config)));
  }

  // Human verified labels win over anything the heuristics produced.
  const candidates = applyVerifiedLabels(resolved, config);
  const staleOverrides = findStaleOverrides(resolved, config);

  const changes = await applyCandidates(page, candidates, confidencePolicy);

  let after = await runTargetedAxe(page, supportedRules);
  let metrics = createMetrics(targetedBefore, after, supportedRules);
  let rolledBack = false;

  if (rollbackOnRegression && !metrics.noRegression) {
    await rollbackPatches(page, changes.fixed);
    after = await runTargetedAxe(page, supportedRules);
    metrics = createMetrics(targetedBefore, after, supportedRules);
    rolledBack = true;
  }

  const fixed = rolledBack ? [] : changes.fixed;

  return {
    engineVersion: ENGINE_VERSION,
    inputAxe: axeResult,
    beforeAxe: targetedBefore,
    targets,
    candidates,
    fixed,
    review: changes.review,
    skipped: changes.skipped,
    rolledBack,
    metrics,
    duplicateLabels: findDuplicateLabels(fixed),
    staleOverrides,
    afterAxe: after,
  };
}

export {
  DEFAULT_CONFIDENCE_POLICY,
  SUPPORTED_RULES,
  createRegressionReport,
  rollbackPatches,
};
