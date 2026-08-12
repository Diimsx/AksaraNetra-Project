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
export async function withBrowser(task, { headless = true, signal = null } = {}) {
  signal?.throwIfAborted();
  const browser = await chromium.launch({ headless });
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
 * Menunggu halaman tenang, lalu menggulir sampai bawah.
 *
 * Banyak konten pemerintah baru dimuat saat digulir. Tanpa langkah ini audit
 * hanya melihat sebagian halaman.
 */
export async function settlePage(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(8_000);

  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let position = 0;
      const maximum = Math.max(document.body.scrollHeight, 1);
      const timer = setInterval(() => {
        window.scrollBy(0, 600);
        position += 600;
        if (position >= maximum) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });

  await page.waitForTimeout(2_000);
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
        ? await page.screenshot({ fullPage: true })
        : null,
    },
  };
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
