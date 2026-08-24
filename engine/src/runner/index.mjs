/**
 * Orkestrasi browser.
 *
 * Satu-satunya tempat yang tahu soal Playwright. Tidak menyentuh berkas sama
 * sekali, supaya bagian ini bisa dipakai ulang oleh server tanpa ikut menulis
 * ke disk. Penulisan hasil adalah urusan modul snapshot.
 */

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { remediatePage } from "../engine/index.mjs";
import { checkResponse, MAX_RESPONSE_BYTES } from "../fetcher/url-policy.mjs";
import { getSiteConfig } from "../config/sites.mjs";

export const WCAG_TAGS = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
]);

export const USER_AGENT = "ProjectA-Accessibility-Research/0.2";

export const CONTEXT_OPTIONS = Object.freeze({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
  userAgent: USER_AGENT,
});

/**
 * Menjalankan sebuah tugas dengan browser yang dijamin ditutup kembali.
 *
 * AxeBuilder butuh page yang lahir dari context, bukan dari browser langsung.
 * Ini pernah jadi bug, jadi urutannya dikunci di sini.
 */
// Flag ini dibaca dari environment supaya bisa dinyalakan hanya di container
// dengan resource terbatas (Render Free: 0.1 CPU / 512MB), tanpa mengubah
// perilaku default saat dijalankan lokal (docker run biasa / npm run dev).
//
// --disable-dev-shm-usage : Docker membatasi /dev/shm ke 64MB secara default.
//   Chromium memakai /dev/shm untuk shared memory antar-proses render; kalau
//   penuh, Chromium bisa crash diam-diam atau jadi sangat lambat. Flag ini
//   memaksa Chromium pakai /tmp biasa sebagai gantinya.
// --disable-gpu            : tidak ada GPU di container, jadi proses inisialisasi
//   GPU compositor cuma menambah waktu startup tanpa manfaat.
// --no-sandbox              : menonaktifkan sandbox proses Chromium. Ini
//   trade-off keamanan (biasanya diterima karena container sendiri sudah
//   terisolasi, dan target audit adalah domain pemerintah tepercaya, bukan
//   sembarang website), tapi mengurangi jumlah proses anak yang di-spawn
//   Chromium -- CPU sangat terbatas seperti 0.1 vCPU lebih diuntungkan oleh
//   pengurangan proses ini.
//
// Flag tambahan di bawah ini semuanya mematikan subsistem Chromium yang
// sama sekali tidak dipakai audit ini (extension, sync, crash reporter,
// auto-update, dsb) tapi tetap dialokasikan RAM-nya kalau tidak dimatikan
// eksplisit. Satu per satu kecil, tapi di container 512MB gabungannya cukup
// terasa -- ini bukan optimasi kode lagi, ini cuma menyuruh Chromium tidak
// menyalakan hal yang memang tidak kita perlukan.
//
// --renderer-process-limit=1 : batasi jumlah proses renderer jadi satu.
//   Chromium biasanya memberi tiap tab proses renderer sendiri; kita cuma
//   pernah punya satu page per browser (lihat withBrowser), jadi batas ini
//   tidak mengurangi kemampuan, cuma mencegah Chromium menyisakan alokasi
//   untuk renderer tambahan yang tidak akan pernah dipakai.
// --js-flags=--max-old-space-size=192 : batas heap V8 di proses renderer.
//   Tanpa ini V8 boleh tumbuh sampai batas defaultnya sendiri (bisa lebih
//   dari sisa RAM container), lalu container di-OOM-kill oleh kernel tanpa
//   sempat GC. Dengan batas eksplisit, V8 akan GC lebih agresif duluan.
const CONTAINER_LAUNCH_ARGS = [
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-domain-reliability",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-first-run",
  "--renderer-process-limit=1",
  "--js-flags=--max-old-space-size=160",
];

function resolveLaunchArgs() {
  // Aktif bila CHROMIUM_LOW_RESOURCE_MODE=1 atau di lingkungan production container
  const isLowResource =
    process.env.CHROMIUM_LOW_RESOURCE_MODE === "1" ||
    process.env.NODE_ENV === "production";

  return isLowResource ? CONTAINER_LAUNCH_ARGS : [];
}

export async function withBrowser(task, { headless = true, signal = null } = {}) {
  signal?.throwIfAborted();
  const browser = await chromium.launch({ headless, args: resolveLaunchArgs() });
  const context = await browser.newContext(CONTEXT_OPTIONS);
  const page = await context.newPage();
  const abort = () => context.close().catch(() => {});
  signal?.addEventListener("abort", abort, { once: true });

  try {
    signal?.throwIfAborted();
    return await task({ page, context, browser });
  } finally {
    signal?.removeEventListener("abort", abort);
    await context.close();
    await browser.close();
  }
}

/**
 * Menunggu halaman tenang, lalu menggulir terukur.
 *
 * Menggulir memicu lazy-loaded kartu berita di viewport tanpa meledakkan DOM
 * ke puluhan ribu node pada portal berita tak terbatas (infinite scroll).
 */
export async function settlePage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let position = 0;
      const targetMax = Math.min(document.body.scrollHeight || 3000, 3600);
      const timer = setInterval(() => {
        window.scrollBy(0, 800);
        position += 800;
        if (position >= targetMax) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  });

  await page.waitForTimeout(1_000);
}

/**
 * Membuka satu halaman, mengaudit, menambal, lalu mengaudit ulang.
 *
 * @returns laporan engine beserta bahan mentahnya. Tidak ada berkas ditulis.
 */
export async function auditPage({
  page,
  url,
  siteConfig,
  captureScreenshot = true,
  signal = null,
  onProgress = null,
}) {
  const config = siteConfig || getSiteConfig(url);
  const progress = async (value, stage) => {
    signal?.throwIfAborted();
    await onProgress?.({ progress: value, stage });
  };

  await progress(35, "Membuka halaman target");
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // Status selain 2xx bukan audit yang berhasil. Halaman error yang bersih
  // tidak boleh dilaporkan sebagai halaman yang aksesibel.
  if (!response || !response.ok()) {
    throw new Error(`HTTP ${response?.status() ?? "tidak diketahui"}`);
  }

  const responseVerdict = checkResponse({
    status: response.status(),
    contentType: response.headers()["content-type"],
    contentLength: response.headers()["content-length"],
  });
  if (!responseVerdict.ok) {
    throw new Error(`${responseVerdict.code}: ${responseVerdict.message}`);
  }

  await progress(43, "Menunggu konten halaman selesai dimuat");
  await settlePage(page);

  const renderedBytes = await page.evaluate(() =>
    new TextEncoder().encode(document.documentElement.outerHTML).byteLength,
  );
  if (renderedBytes > MAX_RESPONSE_BYTES) {
    throw new Error(
      `response-too-large: DOM hasil render melebihi ${MAX_RESPONSE_BYTES} byte`,
    );
  }

  // Pemindaian luas sebelum patch. Dipakai sebagai konteks halaman dan
  // pembanding regression, bukan sebagai baseline metrik engine.
  await progress(53, "Mengaudit aksesibilitas awal");
  const wcagBefore = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  await progress(63, "Menerapkan dan memverifikasi patch");
  const result = await remediatePage({ page, axeResult: wcagBefore, config });

  // remediatePage sudah menjalankan pemindaian luas dan rollback individual.
  // Pakai hasil final itu agar laporan dan artefak mengukur DOM yang sama.
  const wcagAfter = result.wideAfterAxe;

  await progress(75, "Mengumpulkan bukti audit");
  const report = {
    engineVersion: result.engineVersion,
    page: {
      requestedUrl: url,
      finalUrl: page.url(),
      status: response.status(),
      title: await page.title(),
      testedAt: new Date().toISOString(),
    },
    siteConfig: {
      host: config.host,
      matchedHost: config.matchedHost,
      configured: config.configured,
      siteLabel: config.siteLabel,
      verifiedLabelCount: Object.keys(config.verifiedLabels || {}).length,
    },
    targets: result.targets,
    fixed: result.fixed,
    review: result.review,
    skipped: result.skipped,
    rolledBack: result.rolledBack,
    metrics: result.metrics,
    wcagRegression: result.wideRegression,
    duplicateLabels: result.duplicateLabels,
    staleOverrides: result.staleOverrides,
    rolledBackRecords: result.rolledBackRecords,
  };

  return {
    report,
    siteConfig: config,
    artifacts: {
      beforeAxe: result.beforeAxe,
      afterAxe: result.afterAxe,
      wcagBefore,
      wcagAfter,
      ariaSnapshot: await page.locator("body").ariaSnapshot(),
      screenshot: captureScreenshot
        ? await captureBoundedScreenshot(page)
        : null,
    },
  };
}

// Batas tinggi tangkapan layar saat CHROMIUM_LOW_RESOURCE_MODE aktif.
//
// fullPage:true tanpa batas berarti Chromium harus merender SELURUH tinggi
// halaman jadi satu bitmap sebelum di-encode -- untuk halaman pemerintah
// yang panjang (beberapa ribu piksel), ini sendirian bisa jadi lonjakan RAM
// terbesar dalam satu audit, lebih besar dari axe-core atau DOM-nya sendiri.
// Nilai ini dibiarkan longgar (halaman umum tetap tertangkap penuh) tapi
// mencegah kasus ekstrem (halaman arsip/listing yang sangat panjang) dari
// membuat container OOM hanya demi satu gambar pratinjau.
const MAX_SCREENSHOT_HEIGHT_PX = 2400;

async function captureBoundedScreenshot(page) {
  if (process.env.CHROMIUM_LOW_RESOURCE_MODE !== "1") {
    // Perilaku asli di luar container terbatas: PNG, tinggi penuh, tanpa
    // kompromi kualitas. Tidak diubah supaya tangkapan layar lokal / CI
    // tetap seperti sebelumnya.
    return page.screenshot({ fullPage: true });
  }

  const pageHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );

  const clip =
    pageHeight > MAX_SCREENSHOT_HEIGHT_PX
      ? { x: 0, y: 0, width: CONTEXT_OPTIONS.viewport.width, height: MAX_SCREENSHOT_HEIGHT_PX }
      : undefined;

  // Tetap PNG dengan sengaja. FILE_NAMES.screenshot di src/snapshot/index.mjs
  // sudah dikunci sebagai "after.png" dan disebut eksplisit sebagai kontrak
  // dengan frontend -- mengganti ke JPEG di sini tanpa mengubah nama berkas
  // dan penyajian Content-Type di sisi frontend bisa menyebabkan gambar
  // salah dikenali sebagai PNG padahal isinya JPEG. Kalau nanti mau beralih
  // ke JPEG demi RAM lebih hemat lagi, itu perubahan kontrak dua sisi
  // (nama berkas + siapa pun yang menyajikannya), sengaja tidak dilakukan
  // sepihak di sini.
  return page.screenshot({ fullPage: clip ? false : true, clip });
}

export async function renderPdf({ html, outputPath, signal = null }) {
  return withBrowser(async ({ page }) => {
    signal?.throwIfAborted();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return outputPath;
  }, { signal });
}
