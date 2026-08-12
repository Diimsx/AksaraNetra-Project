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

const WCAG_REGRESSION_TAGS = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
]);

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

async function runWideAxe(page) {
  return new AxeBuilder({ page }).withTags(WCAG_REGRESSION_TAGS).analyze();
}

async function discoverKeyboardInaccessibleScrollables(page) {
  return page.evaluate(() => {
    const selectorFor = (element) => {
      if (element.id) {
        const candidate = `#${CSS.escape(element.id)}`;
        if (document.querySelectorAll(candidate).length === 1) return candidate;
      }

      const parts = [];
      let current = element;
      while (current && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        const siblings = current.parentElement
          ? [...current.parentElement.children].filter(
              (item) => item.tagName === current.tagName,
            )
          : [];
        const part = siblings.length > 1
          ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})`
          : tag;
        parts.unshift(part);
        const candidate = parts.join(" > ");
        if (document.querySelectorAll(candidate).length === 1) return candidate;
        current = current.parentElement;
      }
      return parts.join(" > ");
    };

    const tabReachable = (element) => {
      if (element.matches("a[href], button, input, select, textarea")) {
        return !element.disabled && element.tabIndex >= 0;
      }
      return element.hasAttribute("tabindex") && element.tabIndex >= 0;
    };

    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const scrollable =
          ((style.overflowY === "auto" || style.overflowY === "scroll") &&
            element.scrollHeight > element.clientHeight) ||
          ((style.overflowX === "auto" || style.overflowX === "scroll") &&
            element.scrollWidth > element.clientWidth);
        if (!scrollable || tabReachable(element)) return false;
        return ![...element.querySelectorAll("*")].some(tabReachable);
      })
      .map(selectorFor)
      .filter(Boolean);
  });
}

function targetSelectors(axeResult, rules) {
  const targets = extractTargets(axeResult, rules);
  return Object.fromEntries(
    rules.map((ruleId) => [ruleId, new Set(targets[ruleId]?.selectors ?? [])]),
  );
}

function unresolvedRecords(records, afterAxe, rules) {
  const remaining = targetSelectors(afterAxe, rules);
  return records.filter((record) => remaining[record.rule]?.has(record.selector));
}

function regressionSelectors(report, afterAxe) {
  const worsenedRules = new Set(report.worsened.map((item) => item.ruleId));
  const selectors = new Set();

  for (const violation of afterAxe?.violations ?? []) {
    if (!worsenedRules.has(violation.id)) continue;
    for (const node of violation.nodes ?? []) {
      if (Array.isArray(node.target) && node.target.length === 1) {
        selectors.add(String(node.target[0]));
      }
    }
  }
  return selectors;
}

function rolledBackRecord(record, reason) {
  return {
    ...record,
    status: "rolled-back",
    rollbackReason: reason,
  };
}

/**
 * Menjalankan remediation dan hanya menyebut sebuah elemen "fixed" setelah
 * target yang sama hilang dari hasil axe. Patch yang tidak menyelesaikan
 * targetnya dibatalkan sendiri, tanpa membuang patch lain yang berhasil.
 */
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
  const targetedBefore = await runTargetedAxe(page, supportedRules);
  const targets = extractTargets(targetedBefore, supportedRules);

  // Versi axe tertentu menganggap tabindex="-1" atau anak dengan tabindex
  // negatif cukup untuk rule scrollable-region. Tambahkan pemeriksaan keyboard
  // langsung agar area yang tidak dapat dicapai dengan Tab tidak lolos.
  if (supportedRules.includes("scrollable-region-focusable")) {
    const discovered = await discoverKeyboardInaccessibleScrollables(page);
    const existing = new Set(targets["scrollable-region-focusable"]?.selectors ?? []);
    for (const selector of discovered) existing.add(selector);
    targets["scrollable-region-focusable"] = {
      ruleId: "scrollable-region-focusable",
      selectors: [...existing],
      count: existing.size,
      discoveredByKeyboardCheck: discovered.length,
    };
  }
  const resolved = [];

  for (const ruleId of supportedRules) {
    const selectors = targets[ruleId]?.selectors ?? [];
    resolved.push(...(await resolvers[ruleId](page, selectors, config)));
  }

  const candidates = applyVerifiedLabels(resolved, config);
  const staleOverrides = findStaleOverrides(resolved, config);
  const changes = await applyCandidates(page, candidates, confidencePolicy);
  const rolledBackRecords = [];

  // Verifikasi per elemen. Atribut yang berhasil dipasang belum otomatis
  // berarti pelanggarannya selesai.
  let after = await runTargetedAxe(page, supportedRules);
  const unresolved = unresolvedRecords(changes.fixed, after, supportedRules);
  if (unresolved.length) {
    await rollbackPatches(page, unresolved);
    rolledBackRecords.push(
      ...unresolved.map((record) =>
        rolledBackRecord(record, "target-still-failing-after-patch"),
      ),
    );
    after = await runTargetedAxe(page, supportedRules);
  }

  let fixed = changes.fixed.filter((record) => !unresolved.includes(record));

  // Pemindaian luas menangkap kerusakan di luar tiga rule target. Jika node
  // regression menunjuk ke elemen yang baru dipatch, hanya patch itu yang
  // dibatalkan. Regression yang tidak dapat diatribusikan tetap dilaporkan
  // sebagai warning karena halaman dinamis dapat berubah sendiri.
  let wideAfterAxe = await runWideAxe(page);
  let wideRegression = createRegressionReport(axeResult, wideAfterAxe);

  if (rollbackOnRegression && !wideRegression.clean && fixed.length) {
    const badSelectors = regressionSelectors(wideRegression, wideAfterAxe);
    const implicated = fixed.filter((record) => badSelectors.has(record.selector));

    if (implicated.length) {
      await rollbackPatches(page, implicated);
      rolledBackRecords.push(
        ...implicated.map((record) =>
          rolledBackRecord(record, "wide-wcag-regression-at-same-selector"),
        ),
      );
      fixed = fixed.filter((record) => !implicated.includes(record));
      after = await runTargetedAxe(page, supportedRules);
      wideAfterAxe = await runWideAxe(page);
      wideRegression = createRegressionReport(axeResult, wideAfterAxe);
    }
  }

  const reportedBefore = targetSelectors(targetedBefore, supportedRules);
  const verifiedFixed = fixed.map((record) => ({
    ...record,
    status: "verified-fixed",
    verifiedBy: reportedBefore[record.rule]?.has(record.selector)
      ? "axe-target-absent-after-patch"
      : "keyboard-postcondition-check",
  }));
  const metrics = createMetrics(targetedBefore, after, supportedRules);

  return {
    engineVersion: ENGINE_VERSION,
    inputAxe: axeResult,
    beforeAxe: targetedBefore,
    targets,
    candidates,
    fixed: verifiedFixed,
    review: changes.review,
    skipped: changes.skipped,
    rolledBack: rolledBackRecords.length > 0,
    rolledBackRecords,
    metrics,
    duplicateLabels: findDuplicateLabels(verifiedFixed),
    staleOverrides,
    afterAxe: after,
    wideAfterAxe,
    wideRegression,
  };
}

export {
  DEFAULT_CONFIDENCE_POLICY,
  SUPPORTED_RULES,
  createRegressionReport,
  rollbackPatches,
};
