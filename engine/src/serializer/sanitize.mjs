/**
 * Aturan keamanan untuk isi halaman orang lain.
 *
 * Murni, tanpa DOM dan tanpa jaringan.
 *
 * Kenapa ini perlu. Begitu kita menyajikan HTML situs lain dari domain kita
 * sendiri, script apa pun di dalamnya berjalan seolah milik kita. Itu berarti
 * lubang XSS di domain Aksara Netra. Jadi script tidak dilemahkan, melainkan
 * dibuang seluruhnya.
 *
 * Efek sampingnya kebetulan menguntungkan: tanpa script, hasil audit jadi jauh
 * lebih stabil karena tidak ada carousel yang berputar sendiri.
 */

export const SAFE_SCHEMES = Object.freeze([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

/** Tag yang dibuang beserta seluruh isinya. */
export const STRIPPED_TAGS = Object.freeze([
  "script",
  "noscript",
  "iframe",
  "object",
  "embed",
  "applet",
  "base",
  "template",
]);

/**
 * Content Security Policy untuk halaman hasil.
 *
 * Tidak ada script-src sama sekali. Kalau ada satu script yang lolos dari
 * pembersihan, baris ini yang menahannya.
 */
export const SNAPSHOT_CSP = [
  "default-src 'none'",
  "img-src https: http: data:",
  "style-src 'unsafe-inline' https: http:",
  "font-src https: http: data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const SAFE_IMAGE_DATA = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mengubah alamat relatif jadi alamat penuh, dan menolak yang berbahaya.
 *
 * @returns alamat yang aman, atau null kalau harus dibuang.
 */
export function absolutizeUrl(value, baseUrl) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Tautan ke bagian lain di halaman yang sama. Tidak ada tujuan luar.
  if (raw.startsWith("#")) return raw;

  if (raw.toLowerCase().startsWith("data:")) {
    // Gambar tertanam boleh. SVG tidak, karena SVG bisa memuat script.
    return SAFE_IMAGE_DATA.test(raw) ? raw : null;
  }

  let url;
  try {
    url = new URL(raw, baseUrl || undefined);
  } catch {
    return null;
  }

  if (!SAFE_SCHEMES.includes(url.protocol)) return null;
  return url.toString();
}

/**
 * Atribut yang tidak boleh ikut.
 *
 * Semua penangan kejadian dibuang berdasarkan awalan "on", bukan berdasarkan
 * daftar nama. Daftar nama selalu ketinggalan satu nama baru.
 */
export function isDangerousAttribute(name) {
  const attribute = String(name ?? "").toLowerCase();
  if (!attribute) return false;
  if (attribute.startsWith("on")) return true;

  return [
    "srcdoc",
    "ping",
    "formaction",
    "http-equiv",
    "xlink:href",
    "integrity",
    "nonce",
  ].includes(attribute);
}

export function isStrippedTag(tagName) {
  return STRIPPED_TAGS.includes(String(tagName ?? "").toLowerCase());
}

/**
 * Membuang perintah di dalam atribut style.
 *
 * expression() dan url(javascript:) adalah cara lama menjalankan kode lewat
 * CSS. Browser modern menolaknya, tetapi kita tidak mengandalkan itu.
 */
export function sanitizeInlineStyle(value) {
  const style = String(value ?? "");
  if (/expression\s*\(|javascript\s*:|behavior\s*:|@import/i.test(style)) {
    return "";
  }
  return style;
}
