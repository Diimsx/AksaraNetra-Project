#!/usr/bin/env node
/**
 * Menjalankan axe pada UI milik kita sendiri.
 *
 * Alasannya sederhana: alat aksesibilitas yang tidak aksesibel tidak layak
 * dipakai sebagai bukti apa pun. Jadi UI ini diuji dengan pemeriksa yang sama
 * seperti yang dipakai untuk memeriksa situs orang lain.
 *
 * Server statis dibuat memakai modul node:http yang sudah ada di Node, bukan
 * paket baru. Tidak ada dependency tambahan untuk perintah ini.
 *
 * Cara memakai:
 *   npm run test:ui
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";

import { WCAG_TAGS, withBrowser } from "../src/runner/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(here, "..", "ui");

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".yml": "text/plain; charset=utf-8",
});

function log(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Server statis sekali pakai.
 *
 * Port 0 berarti sistem yang memilih port bebas. Port tetap akan bertabrakan
 * dengan proses lain di komputer orang, dan kegagalannya sulit dijelaskan.
 */
function startServer(rootDir) {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = requested === "/" ? "/index.html" : requested;
    const target = path.join(rootDir, path.normalize(relative));

    // Penjagaan sederhana supaya permintaan tidak bisa keluar dari folder ui.
    if (!target.startsWith(rootDir)) {
      response.writeHead(403).end("Dilarang");
      return;
    }

    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Berkas tidak ditemukan");
      return;
    }

    const type = MIME_TYPES[path.extname(target)] || "application/octet-stream";
    response.writeHead(200, { "content-type": type });
    fs.createReadStream(target).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function reportViolations(label, violations) {
  if (violations.length === 0) {
    log(`  ${label}: nol violation`);
    return 0;
  }

  log(`  ${label}: ${violations.length} violation`);
  for (const violation of violations) {
    log(`    ${violation.id} (${violation.impact}), ${violation.nodes.length} node`);
    for (const node of violation.nodes.slice(0, 3)) {
      log(`      ${node.target.join(" ")}`);
    }
  }
  return violations.length;
}

async function scan(page, label) {
  const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return reportViolations(label, result.violations);
}

/**
 * Urutan tombol Tab.
 *
 * Sebelumnya urutan ini hanya ditulis di laporan dan dipercaya begitu saja.
 * Kalimat di dokumen tidak menjaga apa pun, jadi sekarang diperiksa program.
 *
 * Yang diperiksa bukan cuma urutannya, tetapi juga dua cacat yang sering luput:
 *
 *   1. Elemen yang bisa difokus tetapi tidak terlihat. Fokusnya seolah hilang,
 *      dan pengguna keyboard menekan Tab ke tempat yang tidak ada.
 *   2. Elemen di dalam bagian yang sedang disembunyikan. Ini bisa terjadi kalau
 *      suatu saat bagian mode langsung disembunyikan dengan cara yang salah.
 */
const MAX_TAB_STOPS = 14;

async function collectTabOrder(page) {
  // Fokus dikembalikan ke awal halaman supaya urutannya bisa diulang. Tanpa ini
  // hasilnya bergantung pada elemen mana yang terakhir tersentuh scan sebelumnya.
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });

  const stops = [];

  for (let langkah = 0; langkah < MAX_TAB_STOPS; langkah += 1) {
    await page.keyboard.press("Tab");

    const stop = await page.evaluate(() => {
      const node = document.activeElement;
      if (!node || node === document.body || node === document.documentElement) return null;

      const kotak = node.getBoundingClientRect();
      const nama =
        node.getAttribute("aria-label") || node.textContent || node.getAttribute("value") || "";

      return {
        tag: node.tagName.toLowerCase(),
        nama: nama.replace(/\s+/g, " ").trim().slice(0, 60),
        tersembunyi: Boolean(node.closest("[hidden]")),
        terlihat: kotak.width > 0 && kotak.height > 0,
      };
    });

    if (!stop) break;
    stops.push(stop);
  }

  return stops;
}

async function checkKeyboardOrder(page, label) {
  const stops = await collectTabOrder(page);
  let masalah = 0;

  log(`  urutan Tab (${label}):`);
  for (const [nomor, stop] of stops.entries()) {
    log(`    ${nomor + 1}. ${stop.tag} ${stop.nama || "tanpa nama"}`);
  }

  if (stops.length < 4) {
    log(`    hanya ${stops.length} perhentian ditemukan, terlalu sedikit untuk halaman ini`);
    masalah += 1;
  }

  // Perhentian pertama harus tautan lewati. Kalau bukan, pengguna keyboard
  // terpaksa melewati seluruh bagian atas halaman setiap kali membuka halaman.
  if (!stops[0]?.nama.includes("Lewati ke isi utama")) {
    log(`    perhentian pertama seharusnya tautan lewati, bukan ${stops[0]?.nama || "tidak ada"}`);
    masalah += 1;
  }

  for (const [nomor, stop] of stops.entries()) {
    if (!stop.terlihat) {
      log(`    perhentian ${nomor + 1} bisa difokus tetapi tidak terlihat: ${stop.tag} ${stop.nama}`);
      masalah += 1;
    }
    if (stop.tersembunyi) {
      log(`    perhentian ${nomor + 1} berada di dalam bagian yang disembunyikan: ${stop.tag} ${stop.nama}`);
      masalah += 1;
    }
    if (!stop.nama) {
      log(`    perhentian ${nomor + 1} tidak punya nama yang bisa dibacakan: ${stop.tag}`);
      masalah += 1;
    }
  }

  if (masalah === 0) log("    tidak ada masalah pada urutan keyboard");
  return masalah;
}

async function main() {
  if (!fs.existsSync(path.join(uiDir, "index.html"))) {
    log("Folder ui tidak ditemukan. Tidak ada yang bisa diuji.");
    process.exitCode = 1;
    return;
  }

  const hasData = fs.existsSync(path.join(uiDir, "data", "index.json"));
  log(`Menguji UI di ${uiDir}`);
  log(
    hasData
      ? "Data hasil audit ditemukan, jadi keadaan berisi data yang diuji."
      : "Data hasil audit belum ada, jadi yang diuji adalah keadaan gagal memuat. Jalankan npm run build:data untuk menguji keadaan berisi data.",
  );
  log("");

  const { server, port } = await startServer(uiDir);
  const address = `http://127.0.0.1:${port}/index.html`;

  let total = 0;

  try {
    await withBrowser(async ({ page }) => {
      await page.goto(address, { waitUntil: "domcontentloaded" });

      // app.mjs menandai body ketika selesai menggambar, baik berhasil maupun
      // gagal. Menunggu penanda ini lebih jujur daripada menunggu waktu tetap.
      await page.waitForSelector("body[data-siap='ya']", { timeout: 15_000 });

      total += await scan(page, "keadaan awal");
      total += await checkKeyboardOrder(page, "keadaan awal");

      const tombolPertama = page.locator(".tombol-situs").first();
      if (await tombolPertama.count()) {
        await tombolPertama.click();
        await page.waitForSelector("body[data-hasil='ya']", { timeout: 15_000 });
        total += await scan(page, "setelah satu situs dipilih");
        total += await checkKeyboardOrder(page, "setelah satu situs dipilih");
      } else {
        log("  setelah satu situs dipilih: dilewati, belum ada situs di dalam data");
      }

      // Layar sempit dipakai sebagai pengganti kasar untuk zoom 200 persen.
      // Ini bukan bukti penuh. Zoom sungguhan tetap harus dicoba manual.
      await page.setViewportSize({ width: 640, height: 800 });
      total += await scan(page, "layar sempit, mendekati zoom 200 persen");
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  log("");
  log(`Total violation: ${total}`);

  if (total > 0) {
    log("Perintah ini dianggap gagal. Satu violation pun tidak boleh dibiarkan.");
    process.exitCode = 1;
    return;
  }

  log("UI lolos pemeriksaan axe untuk tag wcag2a, wcag2aa, wcag21a, dan wcag21aa.");
  log("Catatan: nol violation bukan bukti bahwa UI ini nyaman dipakai. Uji keyboard tetap manual.");
}

await main();
