#!/usr/bin/env node
/**
 * Server lokal untuk mode langsung.
 *
 * Kenapa perintah ini perlu ada:
 * Audit membutuhkan Chromium yang benar benar berjalan. Hosting statis seperti
 * GitHub Pages atau Vercel tidak bisa menjalankan browser, jadi di sana UI hanya
 * bisa menampilkan hasil yang sudah dibuat lebih dulu oleh build:data. Server ini
 * menutup lubang itu di komputer sendiri: UI yang sama, tapi pemakai boleh
 * mengetik alamat apa pun dan hasilnya muncul saat itu juga.
 *
 * Server ini SENGAJA hanya mendengarkan di 127.0.0.1. Alasannya jelas: siapa pun
 * yang bisa mengirim permintaan ke server ini bisa menyuruh komputer ini membuka
 * alamat pilihannya. Selama hanya di 127.0.0.1, yang bisa melakukan itu hanya
 * orang yang sudah memakai komputer ini. Jangan pernah menggantinya ke 0.0.0.0.
 *
 * Cara memakai:
 *   npm run serve
 * lalu buka alamat yang dicetak di layar.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditUrl, MIN_HOST_INTERVAL_MS } from "../src/api/index.mjs";
import { ENGINE_VERSION } from "../src/shared/version.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(here, "..", "ui");
const dataDir = path.join(uiDir, "data");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;

// Batas ukuran badan permintaan. Sebuah alamat tidak pernah sepanjang ini, jadi
// apa pun yang lebih besar hampir pasti salah kirim atau usaha membanjiri memori.
const MAX_BODY_BYTES = 4096;

/*
 * Peta tipe berkas ini kembar dengan yang ada di scripts/test-ui.mjs.
 * Duplikasi ini saya sadari dan saya biarkan, bukan karena tidak terlihat.
 * Alasannya: test-ui.mjs sudah terbukti hijau di komputer pemakai, dan menyatukan
 * kode server ke satu modul bersama berarti berkas itu harus diuji ulang tanpa
 * memberi manfaat baru. Kalau suatu saat peta ini berubah, ubah di dua tempat.
 */
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

function kirimJson(response, status, payload) {
  const badan = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(badan),
    // Hasil audit tidak boleh disimpan penjelajah, karena angkanya berubah
    // setiap kali dijalankan.
    "cache-control": "no-store",
  });
  response.end(badan);
}

/**
 * Membuat nama folder dari alamat.
 *
 * Nama ini dipakai sebagai nama folder di dalam ui/data, jadi hanya huruf, angka,
 * dan tanda hubung yang boleh lewat. Menyusun nama folder langsung dari teks
 * kiriman pemakai adalah cara paling mudah untuk kebobolan penulisan berkas di
 * luar folder yang dimaksud.
 */
function buatIdDariAlamat(alamat) {
  let host = "situs";
  let jalur = "";

  try {
    const url = new URL(alamat);
    host = url.hostname;
    jalur = url.pathname;
  } catch {
    // Alamat yang tidak bisa dibaca tidak perlu ditangani di sini. src/api yang
    // akan menolaknya dengan pesan yang benar. Di sini cukup nama cadangan.
  }

  const bagianHost = host.replace(/[^a-z0-9]+/gi, "-");
  const bagianJalur = jalur
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const gabungan = bagianJalur ? `${bagianHost}-${bagianJalur}` : bagianHost;
  return `manual-${gabungan.replace(/-+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

function bacaBadan(request) {
  return new Promise((resolve, reject) => {
    const potongan = [];
    let ukuran = 0;

    request.on("data", (bagian) => {
      ukuran += bagian.length;
      if (ukuran > MAX_BODY_BYTES) {
        reject(new Error("Isi permintaan terlalu besar."));
        request.destroy();
        return;
      }
      potongan.push(bagian);
    });

    request.on("end", () => resolve(Buffer.concat(potongan).toString("utf8")));
    request.on("error", reject);
  });
}

function layaniBerkas(request, response, requestedPath) {
  const relatif = requestedPath === "/" ? "/index.html" : requestedPath;
  const target = path.join(uiDir, path.normalize(relatif));

  // Penjagaan supaya permintaan tidak bisa keluar dari folder ui.
  if (!target.startsWith(uiDir)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Dilarang");
    return;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Berkas tidak ditemukan");
    return;
  }

  const type = MIME_TYPES[path.extname(target)] || "application/octet-stream";
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  fs.createReadStream(target).pipe(response);
}

/*
 * Hanya satu audit berjalan pada satu waktu.
 *
 * Bukan demi kerapian, tapi karena setiap audit membuka satu Chromium. Kalau
 * pemakai menekan tombol lima kali, komputernya akan membuka lima browser dan
 * hasilnya justru lebih lambat untuk semua orang. Menolak dengan pesan yang jelas
 * lebih baik daripada diam sambil kehabisan memori.
 */
let sedangSibuk = false;

async function tanganiAudit(request, response) {
  if (sedangSibuk) {
    kirimJson(response, 200, {
      ok: false,
      code: "server-busy",
      message:
        "Masih ada satu audit yang sedang berjalan. Tunggu sampai selesai, lalu coba lagi. Satu audit memakai satu browser, jadi tidak dijalankan berbarengan.",
      stage: 0,
      stageName: "menunggu audit lain selesai",
    });
    return;
  }

  let alamat = "";

  try {
    const badan = await bacaBadan(request);
    const isi = badan ? JSON.parse(badan) : {};
    alamat = typeof isi.url === "string" ? isi.url.trim() : "";
  } catch (error) {
    kirimJson(response, 200, {
      ok: false,
      code: "bad-request",
      message: `Permintaan tidak bisa dibaca. Keterangan teknis: ${error.message}`,
      stage: 0,
      stageName: "membaca permintaan",
    });
    return;
  }

  const id = buatIdDariAlamat(alamat);
  const folder = path.join(dataDir, id);

  sedangSibuk = true;
  const mulai = Date.now();
  log(`Audit diminta: ${alamat || "(alamat kosong)"}`);

  try {
    await fsp.mkdir(folder, { recursive: true });

    // origin "manual" menandai di dalam snapshot bahwa hasil ini berasal dari
    // alamat yang diketik orang, bukan dari katalog yang sudah diperiksa.
    const hasil = await auditUrl({
      url: alamat,
      origin: "manual",
      outputDir: folder,
      id,
    });

    const detik = ((Date.now() - mulai) / 1000).toFixed(1);

    if (!hasil.ok) {
      log(`  gagal setelah ${detik} detik: ${hasil.code} pada langkah ${hasil.stage}`);
      kirimJson(response, 200, hasil);
      return;
    }

    const ringkas = hasil.snapshot.summary || {};
    log(
      `  berhasil setelah ${detik} detik: ${ringkas.beforeTotal} masalah menjadi ${ringkas.afterTotal}`,
    );

    kirimJson(response, 200, {
      ok: true,
      id,
      // Folder relatif dipakai UI untuk menyusun tautan ke reader.html.
      dataPath: `data/${id}`,
      snapshot: hasil.snapshot,
    });
  } catch (error) {
    // src/api sudah berjanji tidak melempar error mentah. Kalau sampai ke sini,
    // itu hal yang tidak terduga dan tidak boleh membuat server mati.
    log(`  error tak terduga: ${error.message}`);
    kirimJson(response, 200, {
      ok: false,
      code: "server-error",
      message: `Terjadi kesalahan yang tidak terduga di server lokal. Keterangan teknis: ${error.message}`,
      stage: 0,
      stageName: "menjalankan audit",
    });
  } finally {
    sedangSibuk = false;
  }
}

function tanganiPermintaan(request, response) {
  const url = new URL(request.url, `http://${HOST}`);
  const jalur = decodeURIComponent(url.pathname);

  if (jalur === "/api/status") {
    // UI memakai jawaban ini untuk memutuskan apakah form alamat ditampilkan.
    // Di hosting statis, permintaan ini gagal dan form tetap tersembunyi.
    kirimJson(response, 200, {
      mode: "langsung",
      engineVersion: ENGINE_VERSION,
      minIntervalMs: MIN_HOST_INTERVAL_MS,
    });
    return;
  }

  if (jalur === "/api/audit") {
    if (request.method !== "POST") {
      kirimJson(response, 405, {
        ok: false,
        code: "method-not-allowed",
        message: "Alamat ini hanya menerima metode POST.",
        stage: 0,
        stageName: "memeriksa metode permintaan",
      });
      return;
    }

    tanganiAudit(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    response.end("Metode tidak diizinkan");
    return;
  }

  layaniBerkas(request, response, jalur);
}

function main() {
  if (!fs.existsSync(path.join(uiDir, "index.html"))) {
    log("Folder ui tidak ditemukan. Tidak ada yang bisa dilayani.");
    process.exitCode = 1;
    return;
  }

  const port = Number(process.env.PORT || DEFAULT_PORT);
  const server = http.createServer(tanganiPermintaan);

  // Satu audit bisa berjalan lebih dari satu menit. Batas waktu bawaan Node akan
  // memutus permintaan di tengah jalan, dan pemakai hanya melihat kegagalan tanpa
  // sebab. Batas ini dimatikan karena servernya memang hanya lokal.
  server.requestTimeout = 0;
  server.headersTimeout = 0;

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      log(`Port ${port} sedang dipakai proses lain.`);
      log(`Coba port lain, contohnya: PORT=${port + 1} npm run serve`);
      process.exitCode = 1;
      return;
    }
    log(`Server gagal berjalan. Keterangan teknis: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    const hasData = fs.existsSync(path.join(dataDir, "index.json"));

    log(`Aksara Netra versi ${ENGINE_VERSION}, mode langsung.`);
    log(`Buka di penjelajah: http://${HOST}:${port}/`);
    log("");
    log(
      hasData
        ? "Katalog hasil audit ditemukan, jadi daftar situs akan langsung terisi."
        : "Katalog hasil audit belum ada. Daftar situs akan kosong sampai npm run build:data dijalankan, tapi form alamat sudah bisa dipakai.",
    );
    log(
      `Jeda antar audit ke host yang sama minimal ${MIN_HOST_INTERVAL_MS / 1000} detik. Permintaan tidak ditolak, hanya menunggu.`,
    );
    log("Satu audit berjalan sekitar 30 sampai 90 detik. Tekan Ctrl lalu C untuk berhenti.");
  });

  const berhenti = () => {
    log("");
    log("Server dihentikan.");
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", berhenti);
  process.on("SIGTERM", berhenti);
}

main();
