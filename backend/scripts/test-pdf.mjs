import fs from "node:fs";
import { renderPdf } from "../../engine/src/runner/index.mjs";
import { renderAuditReport } from "../src/report.mjs";

const snapshot = {
  engineVersion: "0.3.0",
  capturedAt: new Date().toISOString(),
  disclaimer: "Tampilan aksesibilitas tidak resmi.",
  source: { title: "Portal Pemerintah", finalUrl: "https://example.com" },
  summary: { beforeTotal: 4, afterTotal: 1, reductionPercent: 75 },
  counts: { fixed: 3 },
  warnings: { wcagRegressionClean: true, worsenedRules: [] },
};
const report = { fixed: [{ rule: "link-name", selector: ".sosial", status: "verified-fixed", confidence: 0.9 }], review: [], rolledBackRecords: [] };
const html = renderAuditReport({ snapshot, report });
fs.mkdirSync("tmp", { recursive: true });
await renderPdf({ html, outputPath: "tmp/report-smoke.pdf" });
