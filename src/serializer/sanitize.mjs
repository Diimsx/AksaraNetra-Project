/** Aturan keamanan untuk HTML hasil milik situs lain. */

export const SAFE_SCHEMES = Object.freeze([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

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

// CSS eksternal dan font eksternal tidak dijalankan dari snapshot. Gambar
// tetap boleh agar konten visual halaman tidak hilang.
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

export function normalizeLang(value) {
  const lang = String(value ?? "").trim().toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(lang) ? lang : "id";
}

export function absolutizeUrl(value, baseUrl, { image = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return image ? null : raw;

  if (raw.toLowerCase().startsWith("data:")) {
    return SAFE_IMAGE_DATA.test(raw) ? raw : null;
  }

  let url;
  try {
    url = new URL(raw, baseUrl || undefined);
  } catch {
    return null;
  }

  if (image) {
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  }

  if (!SAFE_SCHEMES.includes(url.protocol)) return null;
  return url.toString();
}

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

export function sanitizeInlineStyle(value) {
  const style = String(value ?? "");
  if (
    /expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|@import|url\s*\(/i.test(
      style,
    )
  ) {
    return "";
  }
  return style;
}
