/**
 * Satu pintu masuk untuk mengaudit sebuah halaman.
 *
 * Modul ini tidak punya logika aksesibilitas sendiri. Tugasnya hanya merangkai
 * modul lain dalam urutan yang benar, lalu menerjemahkan setiap kegagalan
 * menjadi kalimat yang bisa dibaca orang biasa.
 *
 * Urutan langkah tidak boleh diacak. Semua pemeriksaan alamat harus selesai
 * sebelum browser dibuka, karena membuka browser lebih dulu berarti permintaan
 * jaringan sudah terlanjur dikirim ke alamat yang belum diperiksa.
 *
 * Semua bagian yang menyentuh dunia luar disuntikkan lewat parameter deps.
 * Itu bukan hiasan arsitektur. Tanpa itu urutan langkah tidak bisa diuji tanpa
 * jaringan dan tanpa browser.
 */

import dns from "node:dns/promises";

import {
  checkResolvedAddresses,
  checkUrl,
  MAX_REDIRECTS,
} from "../fetcher/url-policy.mjs";
import { ROBOTS_USER_AGENT, checkRobots } from "../fetcher/robots.mjs";
import { attachGuard, createGuardStats } from "../guard/index.mjs";
import { serializePage } from "../serializer/index.mjs";
import { guaranteesForSnapshot } from "../serializer/guarantees.mjs";
import { summarizeDecisions } from "../decisions/index.mjs";
import {
  DISCLAIMER,
  createSnapshot,
  validateSnapshot,
  writeSnapshot,
} from "../snapshot/index.mjs";

/**
 * Nomor langkah. Dipakai supaya laporan kegagalan menyebut posisi yang tepat,
 * bukan sekadar berkata gagal.
 */
export const STAGES = Object.freeze({
  checkAddress: 1,
  resolveDns: 2,
  robots: 3,
  rateLimit: 4,
  openBrowser: 5,
  attachGuard: 6,
  audit: 7,
  serialize: 8,
  buildSnapshot: 9,
  validate: 10,
  writeFiles: 11,
});

export const STAGE_NAMES = Object.freeze({
  1: "memeriksa bentuk alamat",
  2: "memeriksa hasil DNS",
  3: "membaca robots.txt",
  4: "menerapkan batas laju",
  5: "membuka browser",
  6: "memasang guard",
  7: "menjalankan audit",
  8: "membuat patched.html dan reader.html",
  9: "membuat snapshot",
  10: "memvalidasi snapshot",
  11: "menulis berkas hasil",
});

/**
 * Jeda minimal antar permintaan ke host yang sama.
 *
 * Lima detik bukan angka ajaib. Ini cukup longgar supaya situs pemerintah yang
 * servernya lambat tidak terbebani, dan cukup pendek supaya audit empat situs
 * tetap selesai dalam satu menit.
 */
export const MIN_HOST_INTERVAL_MS = 5000;

/**
 * Catatan kunjungan per host. Sengaja hanya di memori.
 *
 * Menyimpannya ke berkas akan membuat proses batch dan proses manual saling
 * mengunci, dan tidak ada yang bisa menjelaskan kenapa alat menolak berjalan.
 */
const defaultHistory = new Map();

/**
 * Pesan untuk setiap kode kegagalan.
 *
 * Kode dipakai oleh program, pesan dipakai oleh manusia. Keduanya dipisah
 * supaya pesan bisa diperbaiki tanpa merusak kode yang sudah dipakai frontend.
 */
export const FAILURE_MESSAGES = Object.freeze({
  "empty-url": "Alamat halaman masih kosong. Isi dulu alamatnya.",
  "url-too-long": "Alamat halaman terlalu panjang untuk diperiksa dengan aman.",
  "unparseable-url":
    "Alamat halaman tidak bisa dibaca. Periksa ejaannya, dan pastikan diawali http atau https.",
  "protocol-not-allowed":
    "Hanya alamat http dan https yang bisa diaudit. Alamat jenis lain ditolak.",
  "credentials-in-url":
    "Alamat mengandung nama pengguna atau kata sandi. Alat ini hanya untuk halaman publik.",
  "port-not-allowed":
    "Alamat memakai port yang tidak biasa. Hanya port web standar yang diizinkan.",
  "ip-literal-not-allowed":
    "Alamat berupa nomor IP langsung. Masukkan nama domainnya, bukan nomornya.",
  "empty-host": "Alamat tidak menyebutkan nama domain.",
  "local-host-name":
    "Alamat menunjuk ke komputer ini sendiri, bukan ke situs di internet.",
  "hostname-not-allowed":
    "Bentuk nama domain tidak wajar, jadi alamat ini tidak diproses.",
  "dns-empty":
    "Nama domain tidak menghasilkan satu pun alamat IP. Mungkin domainnya salah tulis atau sudah mati.",
  "dns-lookup-failed":
    "Nama domain tidak bisa dicari. Periksa koneksi internet, lalu coba lagi.",
  "blocked-address":
    "Domain ini mengarah ke alamat di dalam jaringan tertutup, jadi seluruh domain ditolak.",
  "robots-unavailable":
    "Berkas robots.txt situs itu tidak bisa dibaca, jadi audit dihentikan. Kalau aturannya tidak jelas, lebih baik berhenti.",
  "robots-disallowed":
    "Situs itu melarang alat otomatis membuka halaman ini lewat robots.txt. Permintaan tidak dilanjutkan.",
  "robots-fetch-failed":
    "Gagal menghubungi situs untuk mengambil robots.txt. Periksa koneksi internet, lalu coba lagi.",
  "browser-failed":
    "Browser gagal dijalankan. Biasanya karena Chromium belum dipasang. Jalankan npx playwright install chromium.",
  "guard-failed":
    "Penyaring permintaan gagal dipasang, jadi audit dibatalkan supaya tidak ada permintaan yang lolos tanpa diperiksa.",
  "status-not-ok":
    "Halaman tidak membalas dengan status berhasil, jadi ini bukan audit yang sah. Isi halaman error tidak dihitung.",
  "audit-failed":
    "Audit halaman gagal di tengah jalan. Halaman mungkin terlalu lambat atau berubah saat sedang diperiksa.",
  "serialize-failed":
    "Gagal menyusun tampilan hasil dari halaman itu. Snapshot tidak dibuat karena isinya akan setengah jadi.",
  "snapshot-failed": "Gagal menyusun data hasil akhir.",
  "snapshot-incomplete":
    "Data hasil belum lengkap, jadi tidak layak ditampilkan sebagai hasil audit.",
  "write-failed":
    "Hasil audit gagal ditulis ke folder tujuan. Periksa apakah foldernya bisa ditulisi.",
});

const FALLBACK_MESSAGE =
  "Audit gagal karena alasan yang belum punya penjelasan sendiri. Laporkan kode ini apa adanya.";

/**
 * Menerjemahkan kode menjadi kalimat.
 *
 * Kode yang belum terdaftar tetap mendapat kalimat, bukan undefined. Pesan
 * kosong di layar lebih membingungkan daripada pesan umum yang jujur.
 */
export function messageForCode(code, detail = "") {
  const base = FAILURE_MESSAGES[code] || FALLBACK_MESSAGE;
  return detail ? `${base} Keterangan teknis: ${detail}` : base;
}

/**
 * Berapa lama lagi kita harus menunggu sebelum menyentuh host ini.
 *
 * Fungsi murni, jadi bisa diuji tanpa benar benar menunggu lima detik.
 */
export function nextAllowedDelay({
  host,
  now,
  history,
  interval = MIN_HOST_INTERVAL_MS,
} = {}) {
  const last = history?.get(host);
  if (typeof last !== "number") return 0;

  const elapsed = now - last;
  if (elapsed >= interval) return 0;

  // Waktu sistem bisa bergerak ke belakang. Kalau itu terjadi, tunggu penuh
  // satu selang daripada menghitung jeda negatif.
  if (elapsed < 0) return interval;

  return interval - elapsed;
}

/**
 * Mencatat bahwa host ini baru saja dikunjungi.
 */
export function recordRequest({ host, now, history } = {}) {
  history?.set(host, now);
  return history;
}

function failure(stage, code, detail = "", extra = {}) {
  return {
    ok: false,
    code,
    message: messageForCode(code, detail),
    stage,
    stageName: STAGE_NAMES[stage],
    ...extra,
  };
}

function errorDetail(error) {
  if (!error) return "";
  return typeof error === "string" ? error : error.message || String(error);
}

/**
 * Mencari semua alamat IP untuk sebuah nama domain.
 *
 * Satu domain bisa punya banyak alamat. Memeriksa hanya yang pertama berarti
 * alamat kedua bisa mengarah ke mana saja.
 */
async function resolveHost(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  return records.map((record) => record.address);
}

async function fetchRobots({ origin }) {
  const initial = new URL("/robots.txt", origin);
  let current = initial;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const address = checkUrl(current.toString());
    if (!address.ok) {
      throw new Error(`Redirect robots.txt ditolak: ${address.code}`);
    }
    // Redirect ke host lain diizinkan (misal www.example.com → example.com),
    // selama host tujuan tetap lolos validasi checkResolvedAddresses di bawah.

    const addresses = await resolveHost(address.hostname);
    const resolved = checkResolvedAddresses(addresses);
    if (!resolved.ok) {
      throw new Error(`Redirect robots.txt tidak aman: ${resolved.code}`);
    }

    const response = await fetch(address.url, {
      headers: { "user-agent": ROBOTS_USER_AGENT },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { status: response.status, text: "" };
      if (hop === MAX_REDIRECTS) {
        throw new Error(`robots.txt melewati ${MAX_REDIRECTS} redirect`);
      }
      current = new URL(location, address.url);
      continue;
    }

    const text = response.ok ? await response.text() : "";
    return { status: response.status, text, finalUrl: address.url };
  }

  throw new Error("Redirect robots.txt tidak selesai");
}

/**
 * Playwright sengaja dimuat belakangan.
 *
 * Kalau diimpor di baris atas, setiap test murni ikut menarik seluruh browser
 * driver hanya untuk memanggil satu fungsi hitung hitungan.
 */
async function openBrowser(task) {
  const runner = await import("../runner/index.mjs");
  return runner.withBrowser(task);
}

async function runAudit(args) {
  const runner = await import("../runner/index.mjs");
  return runner.auditPage(args);
}

const DEFAULT_DEPS = Object.freeze({
  resolveHost,
  fetchRobots,
  withBrowser: openBrowser,
  attachGuard,
  auditPage: runAudit,
  serializePage,
  writeSnapshot,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

/**
 * Mengaudit satu halaman dari awal sampai berkas hasil.
 *
 * Fungsi ini tidak pernah melempar error. Pemanggilnya, baik CLI maupun script
 * batch, hanya perlu memeriksa field ok.
 *
 * @param args.url alamat halaman publik yang ingin diaudit
 * @param args.origin dari mana permintaan datang, catalog atau manual
 * @param args.outputDir folder tujuan. null berarti tidak menulis berkas
 * @param args.id nama folder dan nama hasil. Default diambil dari domain
 * @param args.deps pengganti fungsi luar, hanya untuk keperluan test
 * @returns { ok: true, snapshot, files } atau { ok: false, code, message, stage }
 */
export async function auditUrl({
  url,
  origin = "manual",
  outputDir = null,
  id = null,
  deps = {},
  history = defaultHistory,
} = {}) {
  const use = { ...DEFAULT_DEPS, ...deps };

  // Langkah 1. Bentuk alamat.
  const address = checkUrl(url);
  if (!address.ok) {
    return failure(STAGES.checkAddress, address.code, address.message);
  }

  const target = address.url;
  const hostname = address.hostname;

  // Langkah 2. DNS. Satu alamat privat cukup untuk menolak seluruh domain.
  let addresses = [];
  try {
    addresses = await use.resolveHost(hostname);
  } catch (error) {
    return failure(STAGES.resolveDns, "dns-lookup-failed", errorDetail(error));
  }

  const resolved = checkResolvedAddresses(addresses);
  if (!resolved.ok) {
    return failure(STAGES.resolveDns, resolved.code, resolved.message);
  }

  // Langkah 3. robots.txt. Tidak terbaca berarti berhenti, tidak ada berarti lanjut.
  let robotsResponse;
  try {
    robotsResponse = await use.fetchRobots({ origin: target, hostname });
  } catch (error) {
    return failure(STAGES.robots, "robots-fetch-failed", errorDetail(error));
  }

  const robots = checkRobots({
    text: robotsResponse?.text ?? "",
    status: robotsResponse?.status ?? 200,
    url: target,
  });
  if (!robots.ok) {
    return failure(STAGES.robots, robots.code, robots.message);
  }

  // Langkah 4. Batas laju. Menunggu, bukan menolak. Menolak hanya akan membuat
  // pemakai menekan tombol berulang kali.
  const delay = nextAllowedDelay({ host: hostname, now: use.now(), history });
  if (delay > 0) await use.sleep(delay);
  recordRequest({ host: hostname, now: use.now(), history });

  const siteId = id || hostname.replace(/[^a-z0-9]+/g, "-");

  // Langkah 5 sampai 10 berjalan di dalam browser.
  //
  // withBrowser sudah menutup context dan browser di blok finally miliknya,
  // termasuk saat isi task gagal. Karena itu kegagalan di dalam dikembalikan
  // sebagai nilai, bukan dilempar, supaya penutupan tetap berjalan rapi.
  let outcome;
  try {
    outcome = await use.withBrowser(async ({ page }) => {
      // Langkah 6. Guard dipasang sebelum halaman dibuka. Setelah dibuka sudah
      // terlambat, permintaan pertama sudah lewat.
      let guard = createGuardStats();
      try {
        guard = await use.attachGuard({ page, allowedDocumentUrl: target });
      } catch (error) {
        return failure(STAGES.attachGuard, "guard-failed", errorDetail(error));
      }

      // Langkah 7. Audit.
      let audited;
      try {
        audited = await use.auditPage({ page, url: target });
      } catch (error) {
        const detail = errorDetail(error);
        const code = /^HTTP /.test(detail) ? "status-not-ok" : "audit-failed";
        return failure(STAGES.audit, code, detail);
      }

      // Langkah 8. Dua tampilan hasil.
      let views;
      try {
        views = await use.serializePage({
          page,
          sourceUrl: target,
          siteLabel: audited.siteConfig?.siteLabel || null,
          disclaimer: DISCLAIMER,
        });
      } catch (error) {
        return failure(STAGES.serialize, "serialize-failed", errorDetail(error));
      }

      // Langkah 9. Snapshot, plus tiga field tambahan.
      //
      // Ketiganya ditambahkan di sini, bukan di dalam src/snapshot, supaya
      // bentuk snapshot yang sudah dipakai frontend tidak ikut berubah. Semua
      // hanya menambah, tidak ada satu pun field lama yang diubah artinya.
      //
      //   guard            berapa permintaan jaringan yang ditolak
      //   readerGuarantees hal yang selalu benar di tampilan mudah dibaca
      //   decisions        daftar perubahan satu per satu, tanpa HTML mentah
      //
      // readerGuarantees sengaja tidak dihitung dari hasil audit. Isinya akibat
      // dari cara kita membangun halaman, jadi nilainya sama untuk semua situs.
      // Kalau suatu hari isinya berbeda antar situs, itu tanda ada yang salah.
      let snapshot;
      try {
        snapshot = {
          ...createSnapshot({
            id: siteId,
            report: audited.report,
            patchedPage: views.patchedPage,
            readerView: views.readerView,
            origin,
          }),
          guard,
          readerGuarantees: guaranteesForSnapshot(),
          decisions: summarizeDecisions(audited.report),
        };
      } catch (error) {
        return failure(STAGES.buildSnapshot, "snapshot-failed", errorDetail(error));
      }

      // Langkah 10. Validasi, dengan menyebut bagian mana yang belum ada.
      const validation = validateSnapshot(snapshot);
      if (!validation.ok) {
        return failure(
          STAGES.validate,
          "snapshot-incomplete",
          `bagian yang belum ada: ${validation.missing.join(", ")}`,
          { missing: validation.missing },
        );
      }

      return {
        ok: true,
        snapshot,
        report: audited.report,
        artifacts: audited.artifacts,
        views,
      };
    });
  } catch (error) {
    return failure(STAGES.openBrowser, "browser-failed", errorDetail(error));
  }

  if (!outcome?.ok) return outcome;

  // Langkah 11. Menulis berkas, setelah browser ditutup.
  let files = null;
  if (outputDir) {
    try {
      use.writeSnapshot({
        dir: outputDir,
        snapshot: outcome.snapshot,
        report: outcome.report,
        artifacts: outcome.artifacts,
        patchedPage: outcome.views.patchedPage,
        readerView: outcome.views.readerView,
      });
      files = { dir: outputDir, names: { ...outcome.snapshot.files } };
    } catch (error) {
      return failure(STAGES.writeFiles, "write-failed", errorDetail(error));
    }
  }

  return { ok: true, snapshot: outcome.snapshot, files };
}
