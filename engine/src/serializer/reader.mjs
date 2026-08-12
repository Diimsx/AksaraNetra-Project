/**
 * Penyusun reader view.
 *
 * Murni, tanpa DOM. Menerima daftar blok sederhana dan mengembalikan satu
 * dokumen HTML utuh.
 *
 * Di sinilah perluasan scope terjadi, dan hanya di sini. Halaman asli yang
 * kita tambal tidak disentuh warnanya maupun struktur heading-nya, karena
 * mengubah desain orang lain itu berisiko. Di reader view tampilannya milik
 * kita sendiri, jadi kontras dan hierarki heading bukan sesuatu yang
 * "diperbaiki", melainkan sudah benar sejak awal karena kita yang memilih.
 */

import { absolutizeUrl, escapeHtml } from "./sanitize.mjs";
import { dedupeHeadings } from "./blocks.mjs";

/**
 * Warna teks dipilih supaya rasio kontrasnya melewati ambang AAA, yaitu 7:1
 * untuk teks biasa. #1a1a1a di atas #ffffff ada di kisaran 17:1.
 *
 * Klaim ini hanya berlaku untuk teks di reader view. Bukan untuk seluruh
 * halaman, dan bukan untuk seluruh WCAG.
 */
export const READER_TOKENS = Object.freeze({
  background: "#ffffff",
  text: "#1a1a1a",
  link: "#0b3d91",
  linkVisited: "#5b2a86",
  focus: "#b32d00",
  muted: "#3f3f3f",
  rule: "#767676",
});

/*
 * Ditemukan saat meninjau berkas ini: sebelumnya di sini tertulis
 * color-scheme: light dark, padahal kita memaksa latar putih dan teks gelap
 * dan sama sekali tidak menyediakan palet gelap. Akibatnya, di perangkat yang
 * sedang memakai mode gelap, kendali bawaan peramban seperti batang gulir
 * digambar gelap di atas halaman putih. Bukan pelanggaran kontras teks, tetapi
 * menjanjikan dukungan mode gelap yang tidak pernah kita buat.
 *
 * Dijadikan light saja. Kalau nanti mau mendukung mode gelap, palet keduanya
 * harus dibuat lengkap dan diuji, bukan dinyatakan lewat satu baris ini.
 */
export const READER_STYLES = `
:root { color-scheme: light; }
body {
  background: ${READER_TOKENS.background};
  color: ${READER_TOKENS.text};
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 1.125rem;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 42rem;
  padding: 1.5rem 1.25rem 4rem;
}
a { color: ${READER_TOKENS.link}; }
a:visited { color: ${READER_TOKENS.linkVisited}; }
:focus-visible {
  outline: 4px solid ${READER_TOKENS.focus};
  outline-offset: 2px;
}
.lewati {
  position: absolute;
  left: -9999px;
}
.lewati:focus {
  position: static;
  display: inline-block;
  margin-bottom: 1rem;
}
.pemberitahuan {
  border: 2px solid ${READER_TOKENS.rule};
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}
.sumber { color: ${READER_TOKENS.muted}; }
img { max-width: 100%; height: auto; }
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin-top: 2rem; }

/*
 * Jarak teks, WCAG 1.4.12.
 *
 * Semua jarak memakai satuan relatif, dan tidak ada satu pun tinggi tetap
 * dalam piksel. Ini yang membuat halaman tetap utuh ketika pembaca memaksa
 * jarak yang lebih besar lewat pengaturan peramban atau ekstensinya sendiri.
 * Kalau ada yang menambahkan height dalam piksel di sini, jaminan jarak-teks
 * di src/serializer/guarantees.mjs harus dicabut pada saat yang sama.
 */
p { margin: 0 0 2em; }
li { margin-bottom: 0.5em; }

/*
 * Penataan ulang, WCAG 1.4.10.
 *
 * Satu kolom, lebar maksimum dalam rem, dan pemenggalan kata untuk teks
 * panjang. Tautan berita di situs pemerintah sering berupa alamat panjang
 * tanpa spasi, dan tanpa overflow-wrap satu alamat saja cukup untuk memaksa
 * gulir mendatar di layar sempit.
 */
p, li, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
img, table, pre { max-width: 100%; }
`.trim();

/**
 * Merapikan tingkat heading tanpa menyentuh teksnya sedikit pun.
 *
 * Dua aturan: heading isi dimulai dari tingkat 2 karena tingkat 1 dipakai
 * judul halaman, dan tingkat tidak boleh melompat turun lebih dari satu.
 * Halaman yang loncat dari h2 ke h5 membuat pengguna NVDA yang menekan H
 * mengira ada bagian yang terlewat.
 */
export function normalizeOutline(blocks = []) {
  let previous = 1;

  return blocks.map((block) => {
    if (block?.type !== "heading") return block;

    const wanted = Math.min(Math.max(Number(block.level) || 2, 2), 6);
    const level = wanted > previous + 1 ? previous + 1 : wanted;
    previous = level;

    return { ...block, level, originalLevel: block.level };
  });
}

function renderBlock(block, baseUrl) {
  if (!block) return "";

  switch (block.type) {
    case "heading": {
      const text = escapeHtml(block.text);
      if (!text.trim()) return "";

      // Judul berita di situs pemerintah hampir selalu berupa tautan. Kalau
      // tautannya dibuang, pengguna bisa membaca daftar judul tetapi tidak
      // bisa membuka satu berita pun, dan reader view jadi jalan buntu.
      const href = block.href ? absolutizeUrl(block.href, baseUrl) : null;
      const inner = href
        ? `<a href="${escapeHtml(href)}">${text}</a>`
        : text;

      return `<h${block.level}>${inner}</h${block.level}>`;
    }

    case "paragraph": {
      const text = escapeHtml(block.text);
      return text.trim() ? `<p>${text}</p>` : "";
    }

    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = (block.items || [])
        .filter((item) => String(item ?? "").trim())
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return items ? `<${tag}>${items}</${tag}>` : "";
    }

    case "image": {
      const source = absolutizeUrl(block.src, baseUrl);
      if (!source) return "";
      const alt = String(block.alt ?? "").trim();

      // Gambar tanpa alt disembunyikan dari pembaca layar. Kita tidak
      // mengarang deskripsi, dan alt kosong lebih baik daripada nama berkas
      // yang dibacakan huruf per huruf.
      return alt
        ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}">`
        : `<img src="${escapeHtml(source)}" alt="" role="presentation">`;
    }

    case "link": {
      const href = absolutizeUrl(block.href, baseUrl);
      const text = escapeHtml(block.text);
      if (!href || !text.trim()) return "";
      return `<p><a href="${escapeHtml(href)}">${text}</a></p>`;
    }

    default:
      return "";
  }
}

/**
 * Menyusun dokumen reader view yang lengkap.
 */
export function renderReaderDocument({
  title,
  lang = "id",
  sourceUrl,
  siteLabel = null,
  disclaimer,
  blocks = [],
}) {
  if (!sourceUrl) throw new Error("Reader view butuh sourceUrl.");

  const safeSource = absolutizeUrl(sourceUrl, sourceUrl);
  if (!safeSource) throw new Error("sourceUrl tidak aman untuk ditautkan.");

  // Urutannya penting. Judul kembar dibuang lebih dulu, baru tingkat heading
  // dirapikan. Kalau dibalik, tingkat yang sudah dihitung akan ikut menghitung
  // judul yang sebentar lagi dibuang, dan hasilnya jadi meloncat.
  const body = normalizeOutline(dedupeHeadings(blocks))
    .map((block) => renderBlock(block, safeSource))
    .filter(Boolean)
    .join("\n");

  const heading = escapeHtml(title || siteLabel || "Tampilan aksesibilitas");
  const asal = siteLabel ? `${escapeHtml(siteLabel)}` : escapeHtml(safeSource);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title>
<style>${READER_STYLES}</style>
</head>
<body>
<a class="lewati" href="#isi">Lewati ke isi utama</a>
<header>
<p class="pemberitahuan">${escapeHtml(disclaimer)}</p>
<h1>${heading}</h1>
<p class="sumber">Sumber: <a href="${escapeHtml(safeSource)}">${asal}</a></p>
</header>
<main id="isi">
${body}
</main>
<footer>
<p class="sumber"><a href="${escapeHtml(safeSource)}">Buka halaman aslinya</a></p>
</footer>
</body>
</html>
`;
}
