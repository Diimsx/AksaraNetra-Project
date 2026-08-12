/**
 * Site configuration registry.
 *
 * Core engine dan rule resolver tidak boleh mengenal nama situs apa pun.
 * Semua hal yang khusus per situs hidup di file ini saja.
 *
 * Menambah situs baru cukup menambah satu entri di SITE_CONFIGS.
 * Tidak perlu menyentuh src/engine atau src/rules.
 */

export const DEFAULT_SITE_CONFIG = Object.freeze({
  /** Ditempel di belakang label link sosial, contoh "Buka Instagram Sulselprov". */
  siteLabel: "",
  /** Peta pathname atau href ke label yang sudah diverifikasi manusia. */
  knownLinkLabels: {},
  /** Override label tombol generik, kunci: next, previous, close, search, menu. */
  buttonLabels: {},
  /** Override label tombol dalam konteks carousel atau media. */
  mediaButtonLabels: {},
  /**
   * Label yang sudah dicek manusia, dikunci per selector axe.
   *
   * Dipakai ketika engine sudah bekerja sesuai aturan tetapi hasilnya tetap
   * keliru karena markup situs aslinya menyesatkan. Bentuknya:
   *
   *   ".selector": { label: "Nama yang benar", note: "alasan", verifiedOn: "2026-08-08" }
   *
   * Override ini naik ke confidence 1.0 dengan source "verified-override".
   * Angka 1.0 hanya boleh muncul dari sini, tidak pernah dari heuristik.
   */
  verifiedLabels: {},
});

const SITE_CONFIGS = {
  "sulselprov.go.id": {
    siteLabel: "Sulselprov",
    verifiedLabels: {
      // Heading "Opini" berada tepat sebelum region ini di DOM, tetapi isinya
      // daftar Peraturan Gubernur. Engine sudah benar mengikuti aturan
      // heading pendahulu, markup situsnya yang menyesatkan.
      ".max-h-\\[240px\\]": {
        label: "Area gulir daftar Peraturan Gubernur",
        note: "Isi region adalah daftar Pergub, bukan opini. Diperiksa manual di aria-after.yml.",
        verifiedOn: "2026-08-08",
      },
      // Tombol submit di sebelah kotak "Cari informasi...". Ikonnya kaca
      // pembesar, jadi engine menebak "Buka pencarian". Kotaknya sudah
      // terbuka, jadi kata "Buka" menyesatkan.
      ".right-1": {
        label: "Cari",
        note: "Tombol submit pencarian, bukan toggle. Membedakannya dari tombol pencarian di header.",
        verifiedOn: "2026-08-08",
      },
    },
  },
  "kepriprov.go.id": {
    siteLabel: "Kepriprov",
  },
};

function normalizeHost(target = "") {
  const raw = String(target).trim();
  if (!raw) return "";

  let host = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      host = new URL(raw).hostname;
    } catch {
      return "";
    }
  }

  return host.replace(/^www\./i, "").toLowerCase();
}

/**
 * Mengambil konfigurasi untuk sebuah URL atau hostname.
 *
 * Selalu mengembalikan objek yang lengkap. Situs yang belum terdaftar tetap
 * dapat diproses, hanya saja tanpa label khusus. Ini disengaja: engine harus
 * tetap berjalan pada situs yang belum pernah kita lihat.
 */
export function getSiteConfig(target = "") {
  const host = normalizeHost(target);

  const matchedHost = host
    ? Object.keys(SITE_CONFIGS).find(
        (candidate) => host === candidate || host.endsWith(`.${candidate}`),
      ) || ""
    : "";

  const overrides = matchedHost ? SITE_CONFIGS[matchedHost] : {};

  return {
    ...DEFAULT_SITE_CONFIG,
    ...overrides,
    knownLinkLabels: {
      ...DEFAULT_SITE_CONFIG.knownLinkLabels,
      ...(overrides.knownLinkLabels || {}),
    },
    buttonLabels: {
      ...DEFAULT_SITE_CONFIG.buttonLabels,
      ...(overrides.buttonLabels || {}),
    },
    mediaButtonLabels: {
      ...DEFAULT_SITE_CONFIG.mediaButtonLabels,
      ...(overrides.mediaButtonLabels || {}),
    },
    verifiedLabels: {
      ...DEFAULT_SITE_CONFIG.verifiedLabels,
      ...(overrides.verifiedLabels || {}),
    },
    host,
    matchedHost,
    configured: Boolean(matchedHost),
  };
}

export function listConfiguredSites() {
  return Object.keys(SITE_CONFIGS);
}
