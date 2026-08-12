import { classifyConfidence } from "./confidence.mjs";

export async function applyCandidates(page, candidates, policy) {
  const fixed = [];
  const review = [];
  const skipped = [];

  for (const candidate of candidates) {
    const classification = classifyConfidence(candidate.confidence, policy);

    if (classification === "review") {
      review.push({ ...candidate, status: "review" });
      continue;
    }

    if (classification === "skip" || !candidate.patches?.length) {
      skipped.push({ ...candidate, status: "skipped" });
      continue;
    }

    const result = await page.evaluate((candidate) => {
      let element;
      try {
        const matches = document.querySelectorAll(candidate.selector);
        if (matches.length !== 1) {
          return {
            applied: false,
            reason: `Selector matched ${matches.length} elements during apply`,
            appliedPatches: [],
          };
        }
        element = matches[0];
      } catch {
        return {
          applied: false,
          reason: "Selector failed during apply",
          appliedPatches: [],
        };
      }

      const preparedPatches = candidate.patches.map((patch) => ({
        attribute: patch.attribute,
        oldValue: element.hasAttribute(patch.attribute)
          ? element.getAttribute(patch.attribute)
          : null,
        newValue: patch.value,
      }));

      const conflict = preparedPatches.find(
        (patch) =>
          patch.oldValue !== null &&
          patch.oldValue !== "" &&
          patch.oldValue !== patch.newValue,
      );

      if (conflict) {
        return {
          applied: false,
          reason: `Existing ${conflict.attribute} was preserved`,
          appliedPatches: [],
        };
      }

      const appliedPatches = [];
      for (const patch of preparedPatches) {
        element.setAttribute(patch.attribute, patch.newValue);
        appliedPatches.push(patch);
      }

      element.setAttribute("data-project-a-fixed", candidate.rule);
      element.setAttribute("data-project-a-source", candidate.source);
      element.setAttribute(
        "data-project-a-confidence",
        String(candidate.confidence),
      );

      return {
        applied: true,
        reason: "Patch applied",
        appliedPatches,
        htmlAfter: element.outerHTML,
      };
    }, candidate);

    if (result.applied) {
      fixed.push({
        ...candidate,
        status: "applied",
        appliedPatches: result.appliedPatches,
        htmlAfter: result.htmlAfter,
      });
    } else {
      skipped.push({
        ...candidate,
        status: "skipped",
        reason: result.reason,
        appliedPatches: result.appliedPatches,
      });
    }
  }

  return { fixed, review, skipped };
}

export async function rollbackPatches(page, fixedRecords = []) {
  for (const record of [...fixedRecords].reverse()) {
    await page.evaluate((record) => {
      const matches = document.querySelectorAll(record.selector);
      if (matches.length !== 1) return;
      const element = matches[0];

      for (const patch of [...record.appliedPatches].reverse()) {
        if (patch.oldValue === null) {
          element.removeAttribute(patch.attribute);
        } else {
          element.setAttribute(patch.attribute, patch.oldValue);
        }
      }

      element.removeAttribute("data-project-a-fixed");
      element.removeAttribute("data-project-a-source");
      element.removeAttribute("data-project-a-confidence");
    }, record);
  }
}
