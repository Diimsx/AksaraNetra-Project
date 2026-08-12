/**
 * Human verified label overrides.
 *
 * Kadang engine sudah bekerja persis sesuai aturan, tetapi hasilnya tetap
 * keliru karena markup situs aslinya menyesatkan. Contoh nyata: sebuah area
 * gulir berisi daftar Peraturan Gubernur, tetapi heading yang mendahuluinya
 * di DOM berbunyi "Opini".
 *
 * Aturan yang lebih pintar tidak menyelesaikan kasus seperti itu. Yang
 * menyelesaikan adalah manusia yang memeriksa, lalu mengunci hasilnya.
 *
 * Modul ini sengaja tidak tahu situs apa pun. Ia hanya membaca peta yang
 * diberikan lewat config, jadi core engine tetap generik.
 */

const OVERRIDE_SOURCE = "verified-override";

function normalizeEntry(entry) {
  if (typeof entry === "string") return { label: entry };
  if (entry && typeof entry === "object") return entry;
  return null;
}

function replaceLabelPatch(patches = [], label) {
  const others = patches.filter((patch) => patch.attribute !== "aria-label");
  return [...others, { attribute: "aria-label", value: label }];
}

/**
 * Menimpa label kandidat dengan label yang sudah diverifikasi manusia.
 *
 * Confidence naik ke 1.0. Angka itu hanya boleh lahir dari sini, tidak pernah
 * dari heuristik, supaya "1.0" selalu berarti "ada manusia yang bertanggung
 * jawab atas label ini".
 *
 * Source dan confidence lama tetap disimpan di supersededSource dan
 * supersededConfidence supaya jejak auditnya tidak hilang.
 */
export function applyVerifiedLabels(candidates = [], config = {}) {
  const verified = config.verifiedLabels || {};
  if (!Object.keys(verified).length) return candidates;

  return candidates.map((candidate) => {
    const entry = normalizeEntry(verified[candidate.selector]);
    if (!entry?.label) return candidate;

    return {
      ...candidate,
      confidence: 1,
      source: OVERRIDE_SOURCE,
      reason:
        entry.note ||
        "Label was checked by a human and pinned in the site config",
      verifiedOn: entry.verifiedOn || null,
      supersededSource: candidate.source,
      supersededConfidence: candidate.confidence,
      patches: replaceLabelPatch(candidate.patches, entry.label),
    };
  });
}

/**
 * Selector yang terdaftar di config tetapi tidak muncul sebagai kandidat.
 *
 * Berguna untuk mendeteksi override yang sudah basi, misalnya karena situsnya
 * berubah atau masalahnya sudah diperbaiki oleh pemilik situs. Override yang
 * basi harus dihapus, bukan dibiarkan menumpuk.
 */
export function findStaleOverrides(candidates = [], config = {}) {
  const verified = config.verifiedLabels || {};
  const seen = new Set(candidates.map((candidate) => candidate.selector));

  return Object.keys(verified).filter((selector) => !seen.has(selector));
}
