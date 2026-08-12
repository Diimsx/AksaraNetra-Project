#!/usr/bin/env node
/**
 * Mengaudit situs katalog, lalu menulis hasilnya ke ui/data supaya UI bisa
 * dibuka tanpa server audit yang hidup.
 *
 * Daftar situs hanya ada satu tempat, yaitu src/config/catalog.mjs. Script ini
 * tidak boleh punya daftar sendiri. Dua daftar yang harus dijaga bersamaan
 * selalu berakhir berbeda.
 *
 * Sejak versi ini, situs berstatus candidate juga ikut diaudit. Bengkulu dan
 * Lampung butuh tiga baseline di hari yang berbeda sebelum boleh disebut
 * verified, dan itu butuh waktu kalender, bukan waktu kerja. Semakin cepat
 * dimulai semakin baik. Hasilnya dicatat, tetapi statusnya tetap candidate,
 * dan UI tidak boleh menampilkannya seolah sudah terverifikasi.
 *
 * Cara memakai:
 *   npm run build:data
 *   SKIP_CANDIDATES=1 npm run build:data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditUrl } from "../src/api/index.mjs";
import { listCandidateSites, listDemoSites } from "../src/config/catalog.mjs";
import {
  appendEntry,
  createHistory,
  describeStability,
  historyEntryFromSnapshot,
} from "../src/history/index.mjs";
import { ENGINE_VERSION } from "../src/shared/version.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

/**
 * Tempat hasil audit ditulis.
 *
 * Bisa diarahkan lewat DATA_DIR supaya engine ini dapat menulis langsung ke
 * folder public milik aplikasi Next.js, tanpa langkah salin manual. Langkah
 * salin manual selalu terlupakan, dan yang terjadi kemudian adalah UI
 * menampilkan angka lama sambil terlihat baik baik saja.
 *
 * Nilai relatif dihitung dari folder engine, bukan dari tempat perintah
 * dijalankan, supaya hasilnya sama dari direktori mana pun.
 */
const dataDir = process.env.DATA_DIR
	? path.resolve(projectRoot, process.env.DATA_DIR)
	: path.join(projectRoot, "ui", "data");

const INDEX_FILE = "index.json";
const HISTORY_FILE = "history.json";

/**
 * Keterangan yang wajib menempel pada setiap angka persen.
 *
 * Disimpan di data, bukan di HTML, supaya tidak bisa hilang di satu tempat
 * sementara angkanya tetap tampil di tempat lain.
 */
const SCOPE_NOTE =
  "Angka penurunan hanya menghitung rule yang diperbaiki otomatis oleh alat ini, bukan seluruh WCAG.";

function log(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Membaca riwayat yang sudah ada.
 *
 * Riwayat bersifat menambah, bukan menimpa. Kalau berkasnya rusak, kita mulai
 * dari kosong dan mengatakannya, bukan menghentikan seluruh proses. Kehilangan
 * riwayat itu buruk, tetapi tidak sebanding dengan gagal menghasilkan data
 * yang akan dibuka juri.
 */
function readHistory() {
  const file = path.join(dataDir, HISTORY_FILE);
  if (!fs.existsSync(file)) return createHistory();

  try {
    const isi = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isi?.sites) throw new Error("tidak ada field sites");
    return isi;
  } catch (error) {
    log(`Peringatan: ${HISTORY_FILE} tidak bisa dibaca (${error.message}). Riwayat dimulai dari kosong.`);
    return createHistory();
  }
}

function collectSites() {
  const verified = listDemoSites().map((site) => ({ ...site, catalogStatus: "verified" }));

  if (process.env.SKIP_CANDIDATES === "1") {
    log("SKIP_CANDIDATES=1, situs berstatus candidate dilewati.");
    return verified;
  }

  const candidate = listCandidateSites().map((site) => ({ ...site, catalogStatus: "candidate" }));
  return [...verified, ...candidate];
}

async function main() {
  const sites = collectSites();

  if (sites.length === 0) {
    log("Tidak ada situs di katalog. Tidak ada yang diaudit.");
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });

  const verifiedCount = sites.filter((site) => site.catalogStatus === "verified").length;
  const candidateCount = sites.length - verifiedCount;

  log(`Aksara Netra ${ENGINE_VERSION}`);
  log(`Akan mengaudit ${sites.length} situs: ${verifiedCount} verified, ${candidateCount} candidate.`);
  log("");

  let history = readHistory();
  const entries = [];
  let disclaimer = null;
  let ruleIds = [];

  for (const [position, site] of sites.entries()) {
    log(`[${position + 1}/${sites.length}] ${site.name} (${site.catalogStatus})`);
    log(`  alamat: ${site.url}`);

    const startedAt = Date.now();

    // auditUrl tidak pernah melempar error, jadi satu situs yang mati tidak
    // menghentikan seluruh proses. Itu sengaja: laporan yang menyebut satu
    // situs gagal lebih berguna daripada proses yang berhenti di tengah.
    const result = await auditUrl({
      url: site.url,
      origin: "catalog",
      outputDir: path.join(dataDir, site.id),
      id: site.id,
    });

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    if (!result.ok) {
      log(`  GAGAL pada langkah ${result.stage} (${result.stageName})`);
      log(`  ${result.message}`);
      log(`  waktu: ${seconds} detik`);
      log("");

      entries.push({
        id: site.id,
        name: site.name,
        shortName: site.shortName,
        sourceUrl: site.url,
        catalogStatus: site.catalogStatus,
        baselineRuns: site.baselineRuns ?? 0,
        status: "gagal",
        capturedAt: new Date().toISOString(),
        beforeTotal: null,
        afterTotal: null,
        reductionPercent: null,
        failure: {
          code: result.code,
          message: result.message,
          stage: result.stage,
          stageName: result.stageName,
        },
      });
      continue;
    }

    const snapshot = result.snapshot;
    const summary = snapshot.summary || {};

    if (!disclaimer) disclaimer = snapshot.disclaimer;
    if (ruleIds.length === 0) ruleIds = Object.keys(snapshot.rules || {});

    // Riwayat ditulis untuk situs candidate juga. Justru itu gunanya: tiga
    // baseline yang dibutuhkan sebuah situs candidate akan terkumpul sendiri
    // dari workflow harian, tanpa ada yang perlu mencatatnya manual.
    const entriRiwayat = historyEntryFromSnapshot(snapshot);
    if (entriRiwayat) {
      history = appendEntry(history, site.id, entriRiwayat);
    }

    const stability = describeStability(history.sites[site.id] || []);

    log(
      `  berhasil: ${summary.beforeTotal} masalah menjadi ${summary.afterTotal}` +
        ` (turun ${summary.reductionPercent} persen)`,
    );
    log(`  permintaan diblokir guard: ${snapshot.guard?.blocked ?? 0}`);
    log(`  keputusan: ${snapshot.decisions?.applied?.total ?? 0} diterapkan, ` +
      `${snapshot.decisions?.review?.total ?? 0} perlu diperiksa, ` +
      `${snapshot.decisions?.skipped?.total ?? 0} dilewati`);
    log(`  riwayat: ${stability.runs} audit tercatat, ${stability.stable ? "stabil" : "belum stabil"}`);
    log(`  waktu: ${seconds} detik`);
    log("");

    entries.push({
      id: site.id,
      name: site.name,
      shortName: site.shortName,
      sourceUrl: snapshot.source?.requestedUrl || site.url,
      finalUrl: snapshot.source?.finalUrl || site.url,
      title: snapshot.source?.title || site.name,
      catalogStatus: site.catalogStatus,
      baselineRuns: site.baselineRuns ?? 0,
      status: "berhasil",
      capturedAt: snapshot.capturedAt,
      beforeTotal: summary.beforeTotal ?? null,
      afterTotal: summary.afterTotal ?? null,
      reduction: summary.reduction ?? null,
      reductionPercent: summary.reductionPercent ?? null,
      views: snapshot.views || {},

      // Angka ringkas supaya UI tidak perlu membuka snapshot setiap situs hanya
      // untuk menampilkan daftar.
      guardBlocked: snapshot.guard?.blocked ?? null,
      decisionCounts: {
        applied: snapshot.decisions?.applied?.total ?? 0,
        review: snapshot.decisions?.review?.total ?? 0,
        skipped: snapshot.decisions?.skipped?.total ?? 0,
      },
      stability,

      // Tiga audit terakhir ikut ditempel ke index supaya UI tidak perlu
      // mengambil berkas kedua hanya untuk menampilkan riwayat singkat.
      // Riwayat lengkapnya tetap ada di history.json.
      recentRuns: (history.sites[site.id] || []).slice(0, 3).map((item) => ({
        capturedAt: item.capturedAt,
        beforeTotal: item.beforeTotal,
        afterTotal: item.afterTotal,
      })),
    });
  }

  const berhasil = entries.filter((entry) => entry.status === "berhasil");
  const succeeded = berhasil.length;
  const failed = entries.length - succeeded;

  const index = {
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,

    // Kalau semua situs gagal, tidak ada snapshot yang bisa dijadikan sumber
    // teks pemberitahuan. UI harus tetap menampilkan sesuatu yang jujur.
    disclaimer:
      disclaimer ||
      "Belum ada hasil audit yang berhasil, jadi teks pemberitahuan resmi belum tersedia.",

    scope: { rules: ruleIds, note: SCOPE_NOTE },
    counts: {
      total: entries.length,
      succeeded,
      failed,
      verified: entries.filter((entry) => entry.catalogStatus === "verified").length,
      candidate: entries.filter((entry) => entry.catalogStatus === "candidate").length,
    },
    sites: entries,
  };

  fs.writeFileSync(
    path.join(dataDir, INDEX_FILE),
    `${JSON.stringify(index, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(dataDir, HISTORY_FILE),
    `${JSON.stringify(history, null, 2)}\n`,
  );

  log("Ringkasan");
  log(`  berhasil : ${succeeded}`);
  log(`  gagal    : ${failed}`);
  log(`  ditulis  : ${path.join(dataDir, INDEX_FILE)}`);
  log(`  ditulis  : ${path.join(dataDir, HISTORY_FILE)}`);

  // Laporan kesiapan katalog. Ini yang menentukan situs mana yang boleh dipakai
  // sebagai contoh di proposal, dan angkanya tidak boleh ditebak dari ingatan.
  log("");
  log("Kesiapan baseline");
  for (const entry of entries) {
    const runs = history.sites[entry.id]?.length ?? 0;
    const catatan = runs >= 3 ? "cukup untuk dijadikan contoh" : `butuh ${3 - runs} audit lagi`;
    log(`  ${entry.id} (${entry.catalogStatus}): ${runs} audit tercatat, ${catatan}`);
  }

  // Satu situs gagal itu wajar dan tidak menggagalkan proses. Nol situs
  // berhasil berarti ada yang salah pada alat atau pada koneksi, dan itu harus
  // membuat perintah ini dianggap gagal.
  if (succeeded === 0) {
    log("");
    log("Tidak ada satu pun situs yang berhasil diaudit. Periksa koneksi internet,");
    log("lalu pastikan Chromium sudah dipasang dengan npx playwright install chromium.");
    process.exitCode = 1;
  }
}

await main();
