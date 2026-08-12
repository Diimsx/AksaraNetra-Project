/**
 * Pencegat permintaan jaringan di dalam browser.
 *
 * Alasan modul ini ada: memeriksa alamat halaman utama saja tidak cukup.
 * Setelah halaman terbuka, halaman itu bebas meminta gambar, CSS, dan font
 * dari alamat mana pun, termasuk alamat di dalam jaringan kita sendiri.
 * Tanpa pencegat, seluruh kerja src/fetcher bisa dilewati hanya dengan satu
 * tag gambar yang mengarah ke 127.0.0.1.
 *
 * Keputusannya dipisah ke decideRequest supaya bisa diuji tanpa browser.
 * attachGuard hanya pembungkus tipis di atasnya.
 *
 * RISIKO SISA YANG BELUM TERATASI: DNS rebinding.
 * Kita memeriksa DNS satu kali di src/api, lalu Chromium meresolve nama yang
 * sama sekali lagi dengan resolvernya sendiri. Di antara dua resolusi itu,
 * pemilik domain bisa mengganti jawabannya menjadi alamat privat. Pencegat
 * ini memeriksa bentuk alamat, bukan hasil resolusinya, jadi celah tersebut
 * tetap terbuka. Opsi host-resolver-rules milik Chromium mungkin bisa
 * menutupnya, tetapi kami belum pernah mengujinya, jadi jangan mengklaim
 * risiko ini sudah hilang.
 *
 * CATATAN, BELUM DIKERJAKAN: satu hop redirect ke host yang sama.
 * Sekarang tipe document hanya lolos kalau alamatnya sama persis dengan
 * allowedDocumentUrl. Akibatnya situs yang mengalihkan alamatnya gagal diaudit,
 * misalnya yang mengarahkan / ke /home, atau http ke https. Ini akan sering
 * kena kalau pemakai mengetik alamat tanpa https.
 *
 * Keputusan tim: satu hop redirect BOLEH diizinkan, asalkan hostnya sama
 * dengan host yang diminta. Belum dikerjakan, supaya perubahan ini tidak
 * dicampur ke pekerjaan yang sudah hijau.
 *
 * Kalau nanti dikerjakan, syaratnya:
 * 1. Host tujuan harus sama dengan host allowedDocumentUrl. Beda host berarti
 *    tolak, karena pemeriksaan DNS dan robots.txt dilakukan untuk host lama,
 *    bukan host yang baru.
 * 2. Maksimal satu hop. Rantai redirect yang panjang adalah tanda halaman itu
 *    bukan halaman informasi biasa.
 * 3. Alamat tujuan tetap harus lulus checkUrl seperti alamat lain.
 * 4. Alamat akhir wajib tercatat di snapshot sebagai source.finalUrl, supaya
 *    laporan tidak mengaku mengaudit alamat yang sebenarnya tidak dibuka.
 * 5. Butuh test murni untuk tiga keadaan: redirect host sama, redirect host
 *    berbeda, dan redirect dua kali.
 */

import { checkUrl } from "../fetcher/url-policy.mjs";

/**
 * Jenis permintaan yang selalu ditolak.
 *
 * Script diblokir bukan karena kelalaian, melainkan karena dua alasan.
 * Pertama, halaman hasil kita disajikan dari domain kita sendiri, jadi script
 * milik situs lain akan berjalan seolah milik kita. Kedua, tanpa script
 * carousel berhenti berputar, dan hasil audit jadi jauh lebih stabil dari
 * satu jalan ke jalan berikutnya.
 */
export const ALWAYS_BLOCKED = Object.freeze([
  "script",
  "xhr",
  "fetch",
  "websocket",
  "media",
  "eventsource",
  "manifest",
]);

/** Jenis permintaan yang boleh lewat asalkan alamatnya lulus pemeriksaan. */
export const CHECKED_TYPES = Object.freeze(["image", "stylesheet", "font"]);

function block(reason, message) {
  return { allow: false, reason, message: message || null };
}

function pass(reason) {
  return { allow: true, reason, message: null };
}

/**
 * Menentukan satu permintaan boleh lewat atau tidak.
 *
 * Sikap dasarnya menolak. Jenis permintaan yang tidak dikenal ikut ditolak,
 * karena daftar jenis milik Chromium bisa bertambah di versi berikutnya dan
 * kita tidak mau jenis baru otomatis mendapat izin.
 *
 * Catatan tentang tipe document: aturannya hanya alamat yang sama persis
 * dengan target yang boleh lewat. Konsekuensinya, situs yang mengalihkan
 * pengunjung ke alamat lain akan tertahan di sini. Itu memang disengaja,
 * tetapi kalau suatu saat ada situs katalog yang mengalihkan, gejalanya akan
 * terlihat sebagai audit gagal, bukan sebagai halaman kosong.
 */
export function decideRequest({ resourceType, url, allowedDocumentUrl } = {}) {
  const type = String(resourceType ?? "").trim().toLowerCase();

  if (!type) {
    return block("missing-resource-type", "Permintaan tanpa jenis ditolak.");
  }

  if (ALWAYS_BLOCKED.includes(type)) {
    return block(
      `blocked-type-${type}`,
      `Jenis permintaan ${type} tidak pernah diizinkan.`,
    );
  }

  if (type === "document") {
    const target = checkUrl(allowedDocumentUrl);
    if (!target.ok) {
      return block(
        "document-target-invalid",
        "Alamat target tidak sah, jadi tidak ada yang bisa dibandingkan.",
      );
    }

    const asked = checkUrl(url);
    if (!asked.ok) {
      return block(`document-${asked.code}`, asked.message);
    }

    if (asked.url !== target.url) {
      return block(
        "document-not-the-target",
        "Hanya halaman yang diminta pengguna yang boleh dibuka.",
      );
    }

    return pass("document-is-the-target");
  }

  if (CHECKED_TYPES.includes(type)) {
    const asked = checkUrl(url);
    if (!asked.ok) {
      return block(`asset-${asked.code}`, asked.message);
    }

    return pass(`asset-${type}-allowed`);
  }

  return block(
    "resource-type-not-recognised",
    `Jenis permintaan ${type} belum dikenal, jadi ditolak.`,
  );
}

/**
 * Bentuk awal statistik. Dipisah supaya bisa dipakai saat guard tidak dipasang.
 */
export function createGuardStats() {
  return { allowed: 0, blocked: 0, byType: {}, blockedHosts: [] };
}

/**
 * Memasang pencegat pada sebuah halaman.
 *
 * @returns objek statistik yang terus diperbarui selama halaman dimuat.
 */
export async function attachGuard({ page, allowedDocumentUrl }) {
  const stats = createGuardStats();
  const hosts = new Set();

  await page.route("**/*", async (route) => {
    const request = route.request();
    const type = request.resourceType();
    const url = request.url();

    const decision = decideRequest({
      resourceType: type,
      url,
      allowedDocumentUrl,
    });

    if (!stats.byType[type]) stats.byType[type] = { allowed: 0, blocked: 0 };

    if (decision.allow) {
      stats.allowed += 1;
      stats.byType[type].allowed += 1;
      await route.continue();
      return;
    }

    stats.blocked += 1;
    stats.byType[type].blocked += 1;

    try {
      hosts.add(new URL(url).host);
    } catch {
      // Alamat yang tidak bisa dibaca tetap diblokir, hanya tidak dicatat
      // hostnya. Tidak ada gunanya menebak.
    }
    stats.blockedHosts = [...hosts].sort();

    await route.abort("blockedbyclient");
  });

  return stats;
}
