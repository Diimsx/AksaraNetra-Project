/**
 * Alat baris perintah untuk menjalankan engine pada satu halaman.
 *
 * Isinya sengaja tipis. Semua logika ada di src/runner dan src/snapshot,
 * supaya server nanti memakai jalur yang persis sama dengan yang kita uji
 * di sini. Kalau logikanya ditaruh di berkas ini, server akan punya versi
 * keduanya sendiri, dan dua versi pasti berbeda suatu hari.
 */

import path from "node:path";

import { auditPage, withBrowser } from "../src/runner/index.mjs";
import {
  DISCLAIMER,
  createSnapshot,
  validateSnapshot,
  writeSnapshot,
} from "../src/snapshot/index.mjs";
import { serializePage } from "../src/serializer/index.mjs";
import { getSiteConfig } from "../src/config/sites.mjs";
import { CATALOG, isExcluded } from "../src/config/catalog.mjs";

const targetUrl = process.env.TARGET_URL || "https://sulselprov.go.id";
const manualMode = process.env.MANUAL === "1";
const outputDir = path.resolve(process.env.OUTPUT_DIR || "output");

const siteConfig = getSiteConfig(targetUrl);
const catalogEntry = CATALOG.find((entry) => entry.host === siteConfig.host);

if (!siteConfig.configured) {
  console.log(
    `Catatan: ${siteConfig.host || targetUrl} belum terdaftar di src/config/sites.mjs.`,
  );
  console.log("Engine tetap berjalan, hanya tanpa label khusus situs.\n");
}

if (isExcluded(siteConfig.host)) {
  console.log(
    `Peringatan: ${siteConfig.host} ada di daftar situs tidak stabil.`,
  );
  console.log("Angkanya boleh dilihat, tapi jangan dipakai sebagai klaim.\n");
}

await withBrowser(
  async ({ page }) => {
    const { report, artifacts } = await auditPage({ page, url: targetUrl, siteConfig });

    // Diambil setelah patch, jadi kedua berkas ini memuat hasil kerja engine.
    const { patchedPage, readerView, blockCount } = await serializePage({
      page,
      sourceUrl: report.page.finalUrl,
      siteLabel: siteConfig.siteLabel,
      disclaimer: DISCLAIMER,
    });

    const snapshot = createSnapshot({
      id: catalogEntry?.id || "manual",
      origin: catalogEntry ? "catalog" : "manual",
      report,
      patchedPage,
      readerView,
    });

    writeSnapshot({ dir: outputDir, snapshot, report, artifacts, patchedPage, readerView });

    console.log(`Reader view: ${blockCount} blok konten.`);

    printReport(report, snapshot, outputDir);

    if (manualMode) {
      console.log("\nBrowser tetap terbuka selama 10 menit untuk NVDA.");
      await page.waitForTimeout(600_000);
    }
  },
  { headless: !manualMode },
);

function printReport(report, snapshot, dir) {
  console.dir(report.metrics, { depth: null });

  console.log(`\nFixed: ${snapshot.counts.fixed}`);
  console.log(`Review: ${snapshot.counts.review}`);
  console.log(`Skipped: ${snapshot.counts.skipped}`);
  console.log(`Label terkunci manusia: ${snapshot.counts.verifiedOverrides}`);
  console.log(
    `Site config: ${report.siteConfig.configured ? report.siteConfig.matchedHost : "tidak terdaftar"}`,
  );

  const regression = report.wcagRegression;
  if (regression.clean) {
    console.log("\nRegression WCAG luas: bersih, tidak ada rule yang memburuk.");
  } else {
    console.log("\nRegression WCAG luas: ADA RULE YANG MEMBURUK");
    for (const item of regression.worsened) {
      console.log(`  ${item.ruleId}: ${item.before} -> ${item.after} (naik ${item.delta})`);
    }
    console.log("  Catatan: halaman ini dinamis, sebagian selisih bisa berasal dari");
    console.log("  konten yang berputar, bukan dari patch. Periksa manual.");
  }

  if (report.duplicateLabels.length) {
    console.log("\nNama kembar setelah patch:");
    for (const item of report.duplicateLabels) {
      console.log(`  ${item.count}x "${item.label}"`);
    }
  }

  if (report.staleOverrides.length) {
    console.log("\nOverride di config yang tidak ketemu di halaman:");
    for (const selector of report.staleOverrides) {
      console.log(`  ${selector}`);
    }
    console.log("  Kemungkinan situsnya berubah. Pertimbangkan menghapusnya.");
  }

  const readiness = validateSnapshot(snapshot);
  if (!readiness.ok) {
    console.log(`\nBelum siap demo. Bagian yang belum ada: ${readiness.missing.join(", ")}`);
  }

  console.log(`\nHasil: ${dir}`);
}
