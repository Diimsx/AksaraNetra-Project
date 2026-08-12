import fs from "node:fs";
import path from "node:path";

import { auditUrl } from "../../engine/src/api/index.mjs";
import { renderPdf } from "../../engine/src/runner/index.mjs";
import { renderAuditReport } from "./report.mjs";

export function createAuditor() {
  return async function auditJob({ job, signal, onProgress }) {
    fs.mkdirSync(job.artifactDir, { recursive: true });
    const outcome = await auditUrl({
      url: job.targetUrl,
      id: job.id,
      origin: "manual",
      outputDir: job.artifactDir,
      signal,
      onProgress,
    });

    if (!outcome.ok) {
      const error = new Error(outcome.message);
      error.code = outcome.code;
      error.stage = outcome.stage;
      throw error;
    }

    signal?.throwIfAborted();
    await onProgress?.({ progress: 96, stage: "Membuat laporan PDF" });
    const reportPath = path.join(job.artifactDir, "engine-result.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const reportHtml = renderAuditReport({ snapshot: outcome.snapshot, report });
    fs.writeFileSync(path.join(job.artifactDir, "report.html"), reportHtml);
    await renderPdf({
      html: reportHtml,
      outputPath: path.join(job.artifactDir, "report.pdf"),
      signal,
    });

    await onProgress?.({ progress: 99, stage: "Memfinalisasi hasil" });
    return {
      snapshot: outcome.snapshot,
      artifacts: {
        reader: "reader.html",
        patched: "patched.html",
        reportPdf: "report.pdf",
        screenshot: "after.png",
      },
    };
  };
}
