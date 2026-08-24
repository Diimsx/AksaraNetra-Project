import fs from "node:fs";
import path from "node:path";

import { auditUrl } from "../../engine/src/api/index.mjs";
import { renderPdf } from "../../engine/src/runner/index.mjs";
import { renderAuditReport } from "./report.mjs";

export function createAuditor() {
  return async function auditJob({ job, signal, onProgress }) {
    fs.mkdirSync(job.artifactDir, { recursive: true });

    const snapshotPath = path.join(job.artifactDir, "snapshot.json");
    const reportPath = path.join(job.artifactDir, "engine-result.json");
    let snapshot = null;
    let report = null;

    // Checkpoint 1: Jika snapshot & engine-result sudah tersimpan dari eksekusi sebelumnya,
    // lanjutkan langsung tanpa menjalankan ulang proses browser audit yang berat.
    if (fs.existsSync(snapshotPath) && fs.existsSync(reportPath)) {
      try {
        snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        await onProgress?.({ progress: 95, stage: "Memulihkan hasil audit dari checkpoint tersimpan" });
      } catch {
        snapshot = null;
        report = null;
      }
    }

    if (!snapshot || !report) {
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

      snapshot = outcome.snapshot;
      if (fs.existsSync(reportPath)) {
        try {
          report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        } catch {
          report = null;
        }
      }
    }

    signal?.throwIfAborted();
    await onProgress?.({ progress: 96, stage: "Menyiapkan laporan hasil" });

    const pdfPath = path.join(job.artifactDir, "report.pdf");
    const reportHtmlPath = path.join(job.artifactDir, "report.html");

    if (!fs.existsSync(reportHtmlPath) && report) {
      const reportHtml = renderAuditReport({ snapshot, report });
      fs.writeFileSync(reportHtmlPath, reportHtml);
    }

    if (!fs.existsSync(pdfPath) && fs.existsSync(reportHtmlPath)) {
      try {
        const reportHtml = fs.readFileSync(reportHtmlPath, "utf8");
        await renderPdf({
          html: reportHtml,
          outputPath: pdfPath,
          signal,
        });
      } catch (pdfError) {
        console.warn("Pembuatan PDF dilewati/fallback karena resource rendah:", pdfError?.message || pdfError);
      }
    }

    await onProgress?.({ progress: 99, stage: "Memfinalisasi hasil" });
    return {
      snapshot,
      artifacts: {
        reader: "reader.html",
        patched: "patched.html",
        reportPdf: fs.existsSync(pdfPath) ? "report.pdf" : (fs.existsSync(reportHtmlPath) ? "report.html" : null),
        screenshot: "after.png",
      },
    };
  };
}
