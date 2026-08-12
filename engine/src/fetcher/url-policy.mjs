/**
 * Gerbang keamanan untuk URL yang diminta pengguna.
 *
 * Murni: tanpa jaringan. Bagian yang butuh DNS memanggil checkResolvedAddresses
 * dengan hasil resolusi dari pemanggil, sehingga logikanya tetap bisa diuji
 * tanpa koneksi internet.
 *
 * Aturan dasar yang dipegang berkas ini:
 * 1. Hanya http dan https.
 * 2. Hanya nama domain. Alamat IP mentah selalu ditolak.
 * 3. Semua hasil resolusi DNS harus publik, bukan sebagian.
 * 4. Setiap redirect diperiksa ulang dari nol.
 */

import { classifyIp, parseIpv4 } from "./ip-rules.mjs";

export const ALLOWED_PROTOCOLS = Object.freeze(["http:", "https:"]);

export const DEFAULT_PORTS = Object.freeze({ "http:": "80", "https:": "443" });

export const MAX_URL_LENGTH = 2048;
export const MAX_REDIRECTS = 5;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = Object.freeze([
  "text/html",
  "application/xhtml+xml",
]);

/** Nama yang selalu mengarah ke dalam mesin atau jaringan lokal. */
const BLOCKED_HOSTS = Object.freeze(["localhost", "localhost.localdomain"]);

const BLOCKED_HOST_SUFFIXES = Object.freeze([
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
]);

/**
 * Bentuk nama domain yang wajar. Label berisi huruf, angka, dan tanda hubung,
 * dan bagian terakhir harus huruf.
 *
 * Ini sekaligus menolak bentuk angka seperti "2130706433" dan "127.1", yang
 * sebagian resolver terjemahkan menjadi 127.0.0.1.
 */
const HOSTNAME_SHAPE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function deny(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function allow(extra = {}) {
  return { ok: true, code: null, message: null, ...extra };
}

/**
 * Memeriksa URL mentah dari pengguna, sebelum DNS disentuh.
 */
export function checkUrl(input) {
  const raw = String(input ?? "").trim();

  if (!raw) return deny("empty-url", "URL kosong.");
  if (raw.length > MAX_URL_LENGTH) {
    return deny(
      "url-too-long",
      `URL lebih panjang dari ${MAX_URL_LENGTH} karakter.`,
    );
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return deny("unparseable-url", "URL tidak dapat dibaca.");
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return deny(
      "protocol-not-allowed",
      `Hanya http dan https yang didukung, bukan ${url.protocol.replace(":", "")}.`,
    );
  }

  if (url.username || url.password) {
    return deny(
      "credentials-in-url",
      "URL memuat nama pengguna atau kata sandi.",
    );
  }

  if (url.port && url.port !== DEFAULT_PORTS[url.protocol]) {
    return deny(
      "port-not-allowed",
      `Hanya port standar yang diizinkan, bukan port ${url.port}.`,
    );
  }

  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return deny(
      "ip-literal-not-allowed",
      "Alamat IP langsung tidak diterima. Gunakan nama domain.",
    );
  }

  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (!hostname) return deny("empty-host", "URL tidak memuat nama domain.");

  if (parseIpv4(hostname) || hostname.includes(":")) {
    return deny(
      "ip-literal-not-allowed",
      "Alamat IP langsung tidak diterima. Gunakan nama domain.",
    );
  }

  if (BLOCKED_HOSTS.includes(hostname)) {
    return deny("local-host-name", `Nama ${hostname} mengarah ke mesin lokal.`);
  }

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return deny(
        "local-host-name",
        `Akhiran ${suffix} dipakai untuk jaringan lokal.`,
      );
    }
  }

  if (!HOSTNAME_SHAPE.test(hostname)) {
    return deny(
      "hostname-not-allowed",
      "Nama domain tidak berbentuk wajar.",
    );
  }

  url.hash = "";
  return allow({ url: url.toString(), hostname, protocol: url.protocol });
}

/**
 * Memeriksa seluruh alamat hasil resolusi DNS.
 *
 * Semua alamat harus publik. Cukup satu alamat privat untuk menolak, karena
 * penyerang bisa mengembalikan satu alamat publik dan satu alamat dalam.
 */
export function checkResolvedAddresses(addresses = []) {
  const list = Array.isArray(addresses) ? addresses : [addresses];

  if (list.length === 0) {
    return deny("dns-empty", "Nama domain tidak menghasilkan alamat IP.");
  }

  for (const address of list) {
    const verdict = classifyIp(address);
    if (!verdict.allowed) {
      return deny(
        "blocked-address",
        `Alamat ${address} berada di ${verdict.reason}.`,
        { address },
      );
    }
  }

  return allow({ addresses: list });
}

/**
 * Memeriksa tujuan sebuah redirect.
 *
 * Celah paling umum bukan di URL awal, melainkan di redirect. Alamat publik
 * yang mengarahkan ke 127.0.0.1 lolos kalau hanya URL pertama yang diperiksa.
 */
export function checkRedirect({ to, hop = 1 } = {}) {
  if (hop > MAX_REDIRECTS) {
    return deny(
      "too-many-redirects",
      `Lebih dari ${MAX_REDIRECTS} redirect diikuti.`,
    );
  }

  const verdict = checkUrl(to);
  if (verdict.ok) return { ...verdict, hop };

  return { ...verdict, code: `redirect-${verdict.code}`, hop };
}

/**
 * Memeriksa respons sebelum isinya dipakai.
 *
 * Status selain 2xx tidak boleh dianggap audit yang berhasil. Ini aturan yang
 * kita tetapkan sejak awal supaya halaman error tidak dilaporkan sebagai
 * halaman yang aksesibel.
 */
export function checkResponse({ status, contentType, contentLength } = {}) {
  const code = Number(status);

  if (!Number.isFinite(code)) {
    return deny("no-status", "Respons tidak memiliki status HTTP.");
  }

  if (code === 401 || code === 403) {
    return deny(
      "access-denied",
      `Halaman menolak akses dengan status ${code}. Aksara Netra tidak menembus pembatasan.`,
    );
  }

  if (code < 200 || code > 299) {
    return deny("status-not-ok", `Status HTTP ${code}, bukan 2xx.`);
  }

  const type = String(contentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (type && !ALLOWED_CONTENT_TYPES.includes(type)) {
    return deny(
      "content-type-not-allowed",
      `Jenis isi ${type} bukan halaman HTML.`,
    );
  }

  const size = Number(contentLength);
  if (Number.isFinite(size) && size > MAX_RESPONSE_BYTES) {
    return deny(
      "response-too-large",
      `Ukuran halaman melebihi ${MAX_RESPONSE_BYTES} byte.`,
    );
  }

  return allow({ status: code, contentType: type });
}
