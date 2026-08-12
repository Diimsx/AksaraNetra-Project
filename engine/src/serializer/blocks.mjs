/**
 * Aturan tingkat blok untuk reader view.
 *
 * Murni, tanpa DOM. Bagian yang butuh browser hanya mengumpulkan bahan mentah,
 * lalu berkas ini yang memutuskan. Pemisahan ini disengaja supaya keputusannya
 * bisa diuji tanpa menjalankan browser sama sekali.
 */

/** Sejauh mana kita menengok ke atas untuk mencari tautan sebuah kartu. */
export const MAX_CARD_LEVELS = 3;

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Membuang judul yang isinya sama persis.
 *
 * Satu judul berita sering muncul dua kali di halaman yang sama, misalnya
 * sekali di carousel dan sekali lagi di daftar berita. Elemennya berbeda,
 * teksnya sama. Pengguna pembaca layar yang menekan tombol H akan mendengar
 * judul yang sama dua kali dan mengira ada dua berita.
 *
 * Yang kedua tidak dibuang begitu saja. Kalau kemunculan pertama ternyata
 * tidak bertautan sedangkan kemunculan kedua bertautan, tautannya diambil.
 * Membuang secara buta bisa menghilangkan satu satunya jalan menuju beritanya.
 */
export function dedupeHeadings(blocks = []) {
  const firstAt = new Map();
  const result = [];

  for (const block of blocks) {
    if (block?.type !== "heading") {
      result.push(block);
      continue;
    }

    const key = normalizeText(block.text);
    if (!key) {
      result.push(block);
      continue;
    }

    if (!firstAt.has(key)) {
      firstAt.set(key, result.length);
      result.push({ ...block });
      continue;
    }

    const kept = result[firstAt.get(key)];
    if (!kept.href && block.href) kept.href = block.href;
  }

  return result;
}

/**
 * Memilih tautan untuk judul yang tidak punya tautan sendiri.
 *
 * Bahannya adalah daftar tautan per tingkat kartu, diurutkan dari kartu
 * terdekat ke kartu terjauh. Aturannya sengaja ketat:
 *
 * - Kalau tingkat terdekat yang berisi tautan hanya punya satu tujuan, itu
 *   yang dipakai.
 * - Kalau tingkat itu punya lebih dari satu tujuan, berhenti dan kembalikan
 *   null. Kita tidak menengok lebih jauh ke atas, karena semakin jauh semakin
 *   besar peluang salah tebak.
 *
 * Judul bagian seperti "Peraturan" atau "Opini" memang seharusnya tetap teks
 * biasa. Menebak tujuan sebuah tautan lebih berbahaya daripada membiarkan
 * teks tidak bisa diklik, karena pengguna tidak punya cara memeriksa tebakan
 * kita sebelum menekannya.
 */
export function chooseCardLink(levels = []) {
  const list = Array.isArray(levels) ? levels.slice(0, MAX_CARD_LEVELS) : [];

  for (const level of list) {
    const links = (Array.isArray(level) ? level : []).filter(
      (item) => item && String(item.href ?? "").trim(),
    );

    if (links.length === 0) continue;

    const targets = new Set(links.map((item) => String(item.href).trim()));
    if (targets.size === 1) return String(links[0].href).trim();

    return null;
  }

  return null;
}

/**
 * Mengisi tautan judul yang masih kosong, memakai kandidat dari kartunya.
 */
export function attachCardLinks(blocks = []) {
  return blocks.map((block) => {
    if (block?.type !== "heading") return block;
    if (block.href) {
      const { cardLinks, ...rest } = block;
      return rest;
    }

    const { cardLinks, ...rest } = block;
    const href = chooseCardLink(cardLinks);

    return href ? { ...rest, href } : rest;
  });
}
