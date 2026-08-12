#!/usr/bin/env node
/**
 * Menjalankan axe pada tampilan mudah dibaca yang kita hasilkan sendiri.
 *
 * Kenapa perintah ini ada. Kita sudah menguji UI dengan npm run test:ui, tetapi
 * belum pernah sekali pun menguji reader.html, padahal justru berkas itu yang
 * kita sebut sebagai hasil utama. Ini kelemahan yang paling mudah ditemukan
 * orang lain, dan paling mudah kita tutup sendiri.
 *
 * Bedanya dengan mengaudit situs orang lain: kalau reader.html punya violation,
 * itu sepenuhnya salah kode kita. Tidak ada alasan "situsnya memang begitu".
 * Karena itu satu violation pun membuat perintah ini gagal.
 *
 * Setiap pemeriksaan di sini menopang satu butir di src/serializer/guarantees.mjs.
 * Kalau ada pemeriksaan yang dihapus, butir jaminannya harus dicabut juga.
 *
 * Cara memakai:
 *   npm run test:reader
 *   READER_FILE=output/reader.html npm run test:reader
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";

import { WCAG_TAGS, withBrowser } from "../src/runner/index.mjs";
import { READER_GUARANTEES } from "../src/serializer/guarantees.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

/**
 * Aturan yang harus diminta namanya satu per satu.
 *
 * withTags(WCAG_TAGS) tidak menjalankan aturan ini, karena color-contrast-enhanced
 * bertag AAA dan landmark-one-main serta region bertag best-practice. Selama
 * jaminan kita menyebut ketiganya, ketiganya harus benar benar dijalankan,
 * bukan diasumsikan ikut terperiksa.
 */
const EXTRA_RULES = Object.freeze([
  "color-contrast-enhanced",
  "landmark-one-main",
  "region",
  "page-has-heading-one",
]);

/** Lebar layar untuk memeriksa penataan ulang, WCAG 1.4.10. */
const NARROW_WIDTH = 320;

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
});

function log(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Server statis sekali pakai, port dipilih sistem.
 *
 * reader.html tidak dibuka lewat file:// karena beberapa aturan axe bergantung
 * pada asal halaman, dan hasil di file:// tidak sama dengan hasil di server.
 * Menguji dengan cara yang berbeda dari cara halaman itu dipakai akan
 * menghasilkan rasa aman yang salah.
 */
function startServer(rootDir) {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const target = path.join(rootDir, path.normalize(requested));

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
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Mencari semua reader.html yang ada di komputer ini.
 *
 * Urutannya sengaja: hasil build:data lebih dulu, karena itu yang akan dibuka
 * juri. Folder output dipakai sebagai cadangan supaya perintah ini tetap
 * berguna sebelum build:data pernah dijalankan.
 */
function findReaderFiles() {
  const dariEnv = process.env.READER_FILE;
  if (dariEnv) {
    const target = path.resolve(projectRoot, dariEnv);
    return fs.existsSync(target) ? [target] : [];
  }

  const hasil = [];
  const dataDir = path.join(projectRoot, "ui", "data");

  if (fs.existsSync(dataDir)) {
    for (const nama of fs.readdirSync(dataDir)) {
      const berkas = path.join(dataDir, nama, "reader.html");
      if (fs.existsSync(berkas)) hasil.push(berkas);
    }
  }

  for (const nama of fs.readdirSync(projectRoot)) {
    if (!nama.startsWith("output")) continue;
    const berkas = path.join(projectRoot, nama, "reader.html");
    if (fs.existsSync(berkas)) hasil.push(berkas);
  }

  return hasil;
}

/**
 * Pemeriksaan yang tidak butuh browser.
 *
 * Dikerjakan lewat teks berkasnya langsung, bukan lewat DOM, karena yang ingin
 * dibuktikan adalah tidak ada script yang IKUT TERTULIS. Memeriksa lewat DOM
 * bisa memberi hasil bersih hanya karena peramban menolak menjalankannya.
 */
function checkText(html) {
  const masalah = [];

  const jumlahScript = (html.match(/<script/gi) || []).length;
  if (jumlahScript > 0) masalah.push(`ada ${jumlahScript} tag script`);

  // Atribut penangan kejadian. Pola ini sengaja mensyaratkan tanda sama dengan
  // supaya kata biasa di dalam teks berita tidak ikut terhitung.
  const penangan = html.match(/\son[a-z]+\s*=/gi) || [];
  if (penangan.length > 0) {
    masalah.push(`ada ${penangan.length} atribut penangan kejadian: ${penangan.slice(0, 3).join(" ")}`);
  }

  const javascriptUrl = (html.match(/javascript:/gi) || []).length;
  if (javascriptUrl > 0) masalah.push(`ada ${javascriptUrl} tautan berskema javascript:`);

  const jumlahH1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (jumlahH1 !== 1) masalah.push(`jumlah h1 ada ${jumlahH1}, harus tepat 1`);

  if (!/Buka halaman aslinya/.test(html)) {
    masalah.push("tautan kembali ke halaman aslinya tidak ditemukan");
  }

  return masalah;
}

/**
 * Judul kembar.
 *
 * Ini pemeriksaan yang lahir dari cacat nyata: pada versi 0.1.7, reader view
 * Sulsel masih memuat 6 judul berita yang tertulis dua kali. Perbandingannya
 * memakai huruf kecil dan spasi yang dirapikan, karena dua judul yang sama
 * sering berbeda hanya pada spasi di ujungnya.
 */
async function checkDuplicateHeadings(page) {
  const judul = await page.$$eval("h1, h2, h3, h4, h5, h6", (nodes) =>
    nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim().toLowerCase()),
  );

  const hitungan = new Map();
  for (const teks of judul) {
    if (!teks) continue;
    hitungan.set(teks, (hitungan.get(teks) || 0) + 1);
  }

  const kembar = [...hitungan.entries()].filter(([, jumlah]) => jumlah > 1);
  return { total: judul.length, kembar };
}

function reportViolations(label, violations) {
  if (violations.length === 0) {
    log(`    ${label}: nol violation`);
    return 0;
  }

  log(`    ${label}: ${violations.length} violation`);
  for (const violation of violations) {
    log(`      ${violation.id} (${violation.impact}), ${violation.nodes.length} node`);
    for (const node of violation.nodes.slice(0, 3)) {
      log(`        ${node.target.join(" ")}`);
    }
  }
  return violations.length;
}

async function main() {
  const berkas = findReaderFiles();

  if (berkas.length === 0) {
    log("Tidak ada reader.html yang bisa diuji.");
    log("Jalankan npm run build:data atau npm run test:engine lebih dulu,");
    log("atau tunjuk berkasnya sendiri dengan READER_FILE=folder/reader.html.");
    process.exitCode = 1;
    return;
  }

  log(`Menguji ${berkas.length} berkas reader.html`);
  log(`Aturan tambahan di luar tag WCAG: ${EXTRA_RULES.join(", ")}`);
  log("");

  const { server, port } = await startServer(projectRoot);
  let total = 0;

  try {
    await withBrowser(async ({ page }) => {
      for (const file of berkas) {
        const relatif = path.relative(projectRoot, file).split(path.sep).join("/");
        log(relatif);

        const html = fs.readFileSync(file, "utf8");
        const masalahTeks = checkText(html);
        if (masalahTeks.length === 0) {
          log("    isi berkas: bersih, tanpa script, tanpa penangan kejadian, satu h1");
        } else {
          for (const masalah of masalahTeks) log(`    isi berkas: ${masalah}`);
          total += masalahTeks.length;
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:${port}/${relatif}`, {
          waitUntil: "domcontentloaded",
        });

        const judul = await checkDuplicateHeadings(page);
        if (judul.kembar.length === 0) {
          log(`    judul: ${judul.total} judul, tidak ada yang kembar`);
        } else {
          log(`    judul: ${judul.kembar.length} judul kembar dari ${judul.total} judul`);
          for (const [teks, jumlah] of judul.kembar.slice(0, 5)) {
            log(`      ${jumlah} kali: ${teks.slice(0, 70)}`);
          }
          total += judul.kembar.length;
        }

        const utama = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        total += reportViolations("wcag2a sampai wcag21aa", utama.violations);

        const tambahan = await new AxeBuilder({ page }).withRules([...EXTRA_RULES]).analyze();
        total += reportViolations("kontras AAA dan penanda wilayah", tambahan.violations);

        await page.setViewportSize({ width: NARROW_WIDTH, height: 900 });
        const sempit = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        total += reportViolations(`lebar ${NARROW_WIDTH} piksel`, sempit.violations);

        // Gulir mendatar pada layar sempit adalah kegagalan penataan ulang yang
        // tidak dilaporkan axe, jadi diperiksa langsung.
        const meluber = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        if (meluber) {
          log(`    lebar ${NARROW_WIDTH} piksel: isi meluber, ada gulir mendatar`);
          total += 1;
        } else {
          log(`    lebar ${NARROW_WIDTH} piksel: tidak ada gulir mendatar`);
        }

        log("");
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  log(`Total temuan: ${total}`);

  if (total > 0) {
    log("");
    log("Perintah ini gagal. Tampilan mudah dibaca dibuat oleh kode kita sendiri,");
    log("jadi setiap temuan di sini adalah cacat kita, bukan cacat situs aslinya.");
    log("Jangan melonggarkan pemeriksaan. Perbaiki src/serializer.");
    process.exitCode = 1;
    return;
  }

  log("");
  log(`Semua berkas lolos. ${READER_GUARANTEES.length} jaminan di guarantees.mjs punya dasar.`);
  log("Catatan: nol temuan bukan bukti nyaman dipakai. Uji dengan NVDA tetap wajib,");
  log("panduannya ada di PENGUJIAN-MANUAL.md.");
}

await main();
