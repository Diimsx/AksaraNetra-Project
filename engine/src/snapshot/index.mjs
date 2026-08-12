/**
 * Bentuk baku berkas hasil.
 *
 * Ini kontrak antara engine dan frontend. Selama bentuk ini tidak berubah,
 * kedua sisi bisa dikerjakan bersamaan tanpa saling menunggu.
 *
 * Scope MVP mengunci empat hal yang wajib tampil di layar hasil. Keempatnya
 * harus terbawa di sini, kalau tidak layar hasilnya mustahil dibuat:
 *   1. halaman yang sudah ditambal
 *   2. reader view
 *   3. tautan ke halaman aslinya
 *   4. laporan sebelum dan sesudah
 *
 * Tidak menyentuh browser. Hanya bentuk data dan berkas.
 */

import fs from "node:fs";
import path from "node:path";

export const SNAPSHOT_FORMAT_VERSION = 1;

export const SNAPSHOT_FILE = "snapshot.json";

export const FILE_NAMES = Object.freeze({
  report: "engine-result.json",
  patchedPage: "patched.html",
  readerView: "reader.html",
  axeBefore: "axe-before.json",
  axeAfter: "axe-after.json",
  wcagBefore: "axe-wcag-scan.json",
  wcagAfter: "axe-wcag-scan-after.json",
  ariaSnapshot: "aria-after.yml",
  screenshot: "after.png",
});

/**
 * Kalimat yang wajib ikut di setiap hasil.
 *
 * Ditaruh di data, bukan di frontend, supaya tidak bisa hilang karena seseorang
 * menghapusnya dari satu halaman.
 */
export const DISCLAIMER =
  "Ini adalah tampilan aksesibilitas tidak resmi yang dihasilkan Aksara Netra. " +
  "Konten berasal dari situs terkait. Aksara Netra tidak mengubah situs asli.";

function summarize(metrics = {}) {
  return {
    beforeTotal: metrics.beforeTotal ?? 0,
    afterTotal: metrics.afterTotal ?? 0,
    reduction: metrics.reduction ?? 0,
    reductionPercent: metrics.reductionPercent ?? 0,
    strictImprovement: metrics.strictImprovement === true,
    noRegression: metrics.noRegression === true,
  };
}

/**
 * Menyusun berkas ringkas yang dibaca frontend.
 *
 * @param args.id           pengenal situs dari katalog, atau "manual"
 * @param args.report       laporan lengkap dari runner
 * @param args.patchedPage  HTML halaman yang sudah ditambal, boleh null
 * @param args.readerView   HTML reader view, boleh null
 */
export function createSnapshot({
  id,
  report,
  patchedPage = null,
  readerView = null,
  origin = "catalog",
}) {
  if (!report?.page?.requestedUrl) {
    throw new Error("Snapshot butuh report dengan page.requestedUrl.");
  }

  const metrics = report.metrics || {};

  return {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    id: id || "manual",
    origin,
    engineVersion: report.engineVersion,
    capturedAt: report.page.testedAt || new Date().toISOString(),
    disclaimer: DISCLAIMER,

    // Nomor 3 dari empat hal wajib. Tautan sumber tidak pernah boleh hilang.
    source: {
      requestedUrl: report.page.requestedUrl,
      finalUrl: report.page.finalUrl,
      title: report.page.title,
      status: report.page.status,
      siteLabel: report.siteConfig?.siteLabel ?? null,
    },

    // Nomor 4. Angka yang ditampilkan di layar hasil.
    summary: summarize(metrics),
    rules: metrics.rules || {},
    counts: {
      fixed: report.fixed?.length ?? 0,
      review: report.review?.length ?? 0,
      skipped: report.skipped?.length ?? 0,
      verifiedOverrides: (report.fixed || []).filter(
        (record) => record.source === "verified-override",
      ).length,
    },

    // Nomor 1 dan 2. null berarti belum dibangun, dan frontend harus
    // menyembunyikan tombolnya, bukan menampilkan tautan rusak.
    views: {
      patchedPage: patchedPage ? FILE_NAMES.patchedPage : null,
      readerView: readerView ? FILE_NAMES.readerView : null,
    },

    warnings: {
      rolledBack: report.rolledBack === true,
      wcagRegressionClean: report.wcagRegression?.clean !== false,
      worsenedRules: report.wcagRegression?.worsened ?? [],
      duplicateLabels: report.duplicateLabels ?? [],
      staleOverrides: report.staleOverrides ?? [],
    },

    files: { ...FILE_NAMES },
  };
}

/**
 * Memeriksa apakah sebuah snapshot cukup untuk membangun layar hasil.
 *
 * Dipakai sebagai pagar sebelum sesuatu ditandai siap demo.
 */
export function validateSnapshot(snapshot) {
  const missing = [];

  if (snapshot?.formatVersion !== SNAPSHOT_FORMAT_VERSION) {
    missing.push("formatVersion");
  }
  if (!snapshot?.source?.requestedUrl) missing.push("source.requestedUrl");
  if (!snapshot?.disclaimer) missing.push("disclaimer");
  if (!snapshot?.summary) missing.push("summary");
  if (!snapshot?.views?.patchedPage) missing.push("views.patchedPage");
  if (!snapshot?.views?.readerView) missing.push("views.readerView");

  return { ok: missing.length === 0, missing };
}

/**
 * Menulis snapshot beserta seluruh bahan buktinya ke satu folder.
 */
export function writeSnapshot({ dir, snapshot, report, artifacts = {}, patchedPage, readerView }) {
  fs.mkdirSync(dir, { recursive: true });

  const writeJson = (name, data) =>
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));

  writeJson(SNAPSHOT_FILE, snapshot);
  if (report) writeJson(FILE_NAMES.report, report);

  const optional = [
    [FILE_NAMES.axeBefore, artifacts.beforeAxe],
    [FILE_NAMES.axeAfter, artifacts.afterAxe],
    [FILE_NAMES.wcagBefore, artifacts.wcagBefore],
    [FILE_NAMES.wcagAfter, artifacts.wcagAfter],
  ];
  for (const [name, data] of optional) {
    if (data) writeJson(name, data);
  }

  if (artifacts.ariaSnapshot) {
    fs.writeFileSync(path.join(dir, FILE_NAMES.ariaSnapshot), artifacts.ariaSnapshot);
  }
  if (artifacts.screenshot) {
    fs.writeFileSync(path.join(dir, FILE_NAMES.screenshot), artifacts.screenshot);
  }
  if (patchedPage) {
    fs.writeFileSync(path.join(dir, FILE_NAMES.patchedPage), patchedPage);
  }
  if (readerView) {
    fs.writeFileSync(path.join(dir, FILE_NAMES.readerView), readerView);
  }

  return dir;
}

export function readSnapshot(dir) {
  const file = path.join(dir, SNAPSHOT_FILE);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
