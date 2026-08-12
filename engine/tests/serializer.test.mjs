import test from "node:test";
import assert from "node:assert/strict";

import {
  SNAPSHOT_CSP,
  absolutizeUrl,
  isDangerousAttribute,
  isStrippedTag,
  sanitizeInlineStyle,
} from "../src/serializer/sanitize.mjs";
import {
  READER_STYLES,
  normalizeOutline,
  renderReaderDocument,
} from "../src/serializer/reader.mjs";
import { DISCLAIMER } from "../src/snapshot/index.mjs";
import { ENGINE_VERSION } from "../src/shared/version.mjs";
import {
  attachCardLinks,
  chooseCardLink,
  dedupeHeadings,
} from "../src/serializer/blocks.mjs";

const SOURCE = "https://sulselprov.go.id/berita";

test("reads a repeated headline once and keeps the working link", () => {
  // Judul yang sama muncul di carousel dan di daftar berita. Pengguna NVDA
  // yang menekan H mendengarnya dua kali dan mengira ada dua berita.
  const blocks = dedupeHeadings([
    { type: "heading", level: 3, text: "Gubernur Raih Awards", href: null },
    { type: "paragraph", text: "Isi lain." },
    { type: "heading", level: 3, text: "Gubernur Raih Awards", href: "/berita/12" },
  ]);

  const headings = blocks.filter((block) => block.type === "heading");

  assert.equal(headings.length, 1);
  // Yang kedua tidak dibuang buta. Tautannya diambil, karena kalau tidak,
  // satu satunya jalan menuju beritanya ikut hilang.
  assert.equal(headings[0].href, "/berita/12");

  // Blok yang bukan heading tidak boleh ikut terbuang.
  assert.equal(blocks.length, 2);
});

test("does not merge two headlines that only look similar", () => {
  const blocks = dedupeHeadings([
    { type: "heading", level: 3, text: "Peraturan Gubernur" },
    { type: "heading", level: 3, text: "Peraturan Daerah" },
  ]);

  assert.equal(blocks.length, 2);
});

test("borrows a card link only when there is exactly one destination", () => {
  // Keadaan 1: satu kandidat jelas.
  assert.equal(
    chooseCardLink([[{ href: "/berita/9", text: "Selengkapnya" }]]),
    "/berita/9",
  );

  // Keadaan 2: banyak kandidat. Menebak tujuan lebih berbahaya daripada
  // membiarkan judul jadi teks biasa, karena pengguna tidak bisa memeriksa
  // tebakan kita sebelum menekannya.
  assert.equal(
    chooseCardLink([
      [
        { href: "/berita/9", text: "Baca" },
        { href: "/kategori/ekonomi", text: "Ekonomi" },
      ],
    ]),
    null,
  );

  // Keadaan 3: tidak ada kandidat sama sekali.
  assert.equal(chooseCardLink([[], [], []]), null);
  assert.equal(chooseCardLink([]), null);
});

test("stops looking upwards once a card level is ambiguous", () => {
  // Tingkat terdekat sudah membingungkan. Menengok lebih jauh ke atas hanya
  // memperbesar peluang salah tebak, jadi pencarian berhenti di situ.
  const href = chooseCardLink([
    [{ href: "/a" }, { href: "/b" }],
    [{ href: "/satu-satunya" }],
  ]);

  assert.equal(href, null);
});

test("never overwrites a link the headline already had", () => {
  const blocks = attachCardLinks([
    {
      type: "heading",
      level: 2,
      text: "Punya tautan sendiri",
      href: "/asli",
      cardLinks: [[{ href: "/kartu" }]],
    },
    {
      type: "heading",
      level: 2,
      text: "Judul bagian",
      href: null,
      cardLinks: [[]],
    },
  ]);

  assert.equal(blocks[0].href, "/asli");

  // Judul bagian tetap tanpa tautan. Nilainya null, bukan hilang, karena
  // heading memang selalu membawa kolom href sejak diambil dari halaman.
  assert.equal(blocks[1].href, null);

  // cardLinks adalah bahan mentah, bukan bagian dari hasil. Kalau ikut
  // terbawa, berkas snapshot jadi membengkak tanpa guna.
  assert.equal("cardLinks" in blocks[0], false);
  assert.equal("cardLinks" in blocks[1], false);
});

test("reports the version the package actually says", async () => {
  // Nomor versi pernah ditulis tangan dan tertinggal di 0.1.3 sementara
  // package.json sudah 0.1.6, jadi berkas bukti salah label.
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

  assert.equal(ENGINE_VERSION, pkg.version);
  assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+$/);
});

test("keeps a headline clickable instead of leaving a dead end", () => {
  // Reader view pertama memuat 23 judul berita tanpa satu pun tautan.
  // Pengguna bisa membaca judulnya, tetapi tidak bisa membuka beritanya.
  const html = renderReaderDocument({
    title: "Beranda",
    sourceUrl: SOURCE,
    disclaimer: DISCLAIMER,
    blocks: [
      { type: "heading", level: 3, text: "Gubernur Raih Awards", href: "/berita/12" },
      { type: "heading", level: 3, text: "Tanpa tautan", href: null },
    ],
  });

  assert.match(html, /<h2><a href="https:\/\/sulselprov\.go\.id\/berita\/12">Gubernur Raih Awards<\/a><\/h2>/);

  // Judul tanpa tautan tetap tampil sebagai teks biasa, bukan tautan kosong.
  // Tingkatnya h3 karena judul pertama sudah dirapikan jadi h2.
  assert.match(html, /<h3>Tanpa tautan<\/h3>/);
});

test("refuses a headline link that could run code", () => {
  const html = renderReaderDocument({
    title: "Beranda",
    sourceUrl: SOURCE,
    disclaimer: DISCLAIMER,
    blocks: [
      { type: "heading", level: 2, text: "Klik saya", href: "javascript:alert(1)" },
    ],
  });

  // Judulnya tetap terbaca, hanya tautannya yang dibuang.
  assert.match(html, /<h2>Klik saya<\/h2>/);
  assert.equal(/javascript:/i.test(html), false);
});

test("turns relative addresses into full ones", () => {
  assert.equal(absolutizeUrl("/foto.png", SOURCE), "https://sulselprov.go.id/foto.png");
  assert.equal(absolutizeUrl("lain", SOURCE), "https://sulselprov.go.id/lain");
  assert.equal(absolutizeUrl("#isi", SOURCE), "#isi");
  assert.equal(absolutizeUrl("https://lain.go.id/a", SOURCE), "https://lain.go.id/a");
});

test("drops any address that can run code", () => {
  for (const value of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "vbscript:msgbox",
    "data:text/html,<script>alert(1)</script>",
    // SVG can carry a script inside it, so embedded SVG is refused too.
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "",
    null,
  ]) {
    assert.equal(absolutizeUrl(value, SOURCE), null, `${value} should be dropped`);
  }

  // An ordinary embedded picture is still fine.
  assert.ok(absolutizeUrl("data:image/png;base64,iVBORw0KGgo=", SOURCE));
});

test("recognises event handlers by their prefix, not by a list of names", () => {
  // A list of names is always one new name behind.
  for (const name of ["onclick", "onerror", "onpointerrawupdate", "ONLOAD"]) {
    assert.equal(isDangerousAttribute(name), true, `${name} should be refused`);
  }

  for (const name of ["srcdoc", "ping", "formaction", "xlink:href"]) {
    assert.equal(isDangerousAttribute(name), true, `${name} should be refused`);
  }

  for (const name of ["href", "alt", "aria-label", "class", "role", "tabindex"]) {
    assert.equal(isDangerousAttribute(name), false, `${name} should be kept`);
  }

  assert.equal(isStrippedTag("SCRIPT"), true);
  assert.equal(isStrippedTag("button"), false);
});

test("empties a style attribute that hides a command", () => {
  assert.equal(sanitizeInlineStyle("width:expression(alert(1))"), "");
  assert.equal(sanitizeInlineStyle("background:url(javascript:alert(1))"), "");
  assert.equal(sanitizeInlineStyle("color:red"), "color:red");
});

test("allows no script at all in the policy", () => {
  assert.match(SNAPSHOT_CSP, /default-src 'none'/);
  assert.equal(SNAPSHOT_CSP.includes("script-src"), false);
  assert.match(SNAPSHOT_CSP, /form-action 'none'/);
});

test("never lets a heading level skip a step", () => {
  const blocks = normalizeOutline([
    { type: "heading", level: 4, text: "Berita" },
    { type: "paragraph", text: "isi" },
    { type: "heading", level: 6, text: "Daerah" },
    { type: "heading", level: 2, text: "Layanan" },
  ]);

  const levels = blocks.filter((b) => b.type === "heading").map((b) => b.level);

  // h4 first becomes h2, because h1 belongs to the page title. h6 can only
  // step down to h3. Going back up to h2 is always allowed.
  assert.deepEqual(levels, [2, 3, 2]);

  // The wording is untouched. Only the level changed.
  assert.equal(blocks[0].text, "Berita");
  assert.equal(blocks[0].originalLevel, 4);
  assert.equal(blocks[1].type, "paragraph");
});

test("builds a reader view with a skip link, landmarks and the source", () => {
  const html = renderReaderDocument({
    title: "Beranda",
    lang: "id",
    sourceUrl: SOURCE,
    siteLabel: "Sulawesi Selatan",
    disclaimer: DISCLAIMER,
    blocks: [
      { type: "heading", level: 3, text: "Pengumuman" },
      { type: "paragraph", text: "Teks asli" },
      { type: "list", ordered: false, items: ["satu", "dua"] },
    ],
  });

  assert.match(html, /<html lang="id">/);
  assert.match(html, /class="lewati" href="#isi"/);
  assert.match(html, /<main id="isi">/);
  assert.match(html, /<header>/);
  assert.match(html, /<footer>/);
  assert.match(html, /tidak mengubah situs asli/);
  assert.match(html, /href="https:\/\/sulselprov\.go\.id\/berita"/);

  // The only h1 is the page title, so the h3 became an h2.
  assert.equal(html.match(/<h1>/g).length, 1);
  assert.match(html, /<h2>Pengumuman<\/h2>/);
  assert.match(html, /<li>satu<\/li><li>dua<\/li>/);
});

test("escapes page text instead of trusting it", () => {
  const html = renderReaderDocument({
    title: "<script>alert(1)</script>",
    sourceUrl: SOURCE,
    disclaimer: DISCLAIMER,
    blocks: [
      { type: "paragraph", text: "<img src=x onerror=alert(1)>" },
      { type: "link", text: "klik", href: "javascript:alert(1)" },
    ],
  });

  // Serving someone else's page from our own domain means their script would
  // run as ours. Nothing executable may survive.
  //
  // The test is about live markup, not about the letters. "onerror=" is
  // allowed to appear as ordinary escaped text, because escaped text cannot
  // run. What must never appear is a real tag or a real attribute.
  assert.equal(html.includes("<script>"), false);
  assert.equal(/<img[^>]*onerror/i.test(html), false);
  assert.equal(/href="javascript:/i.test(html), false);

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<p>&lt;img src=x onerror=alert\(1\)&gt;<\/p>/);
});

test("hides a picture that has no alt rather than inventing one", () => {
  const html = renderReaderDocument({
    title: "x",
    sourceUrl: SOURCE,
    disclaimer: DISCLAIMER,
    blocks: [
      { type: "image", src: "/a.png", alt: "" },
      { type: "image", src: "/b.png", alt: "Gubernur meninjau jalan" },
      { type: "image", src: "javascript:alert(1)", alt: "jahat" },
    ],
  });

  assert.match(html, /<img src="https:\/\/sulselprov\.go\.id\/a\.png" alt="" role="presentation">/);
  assert.match(html, /alt="Gubernur meninjau jalan"/);
  assert.equal(html.includes("jahat"), false);
});

test("refuses to build a reader view with no way back to the real page", () => {
  // The link to the source is part of the locked scope. A reader view without
  // it would be a copy of someone else's page with no attribution.
  assert.throws(
    () => renderReaderDocument({ title: "x", disclaimer: DISCLAIMER, blocks: [] }),
    /sourceUrl/,
  );

  assert.throws(
    () =>
      renderReaderDocument({
        title: "x",
        sourceUrl: "javascript:alert(1)",
        disclaimer: DISCLAIMER,
        blocks: [],
      }),
    /tidak aman/,
  );
});

// Dua jaminan di src/serializer/guarantees.mjs tidak bisa dibuktikan axe, yaitu
// jarak-teks dan satu-kolom. axe memeriksa hasil render, bukan alasannya, dan
// tidak akan pernah memberi tahu kita kalau seseorang mengganti satuan relatif
// dengan piksel. Karena itu keduanya dijaga di sini.

test("reader styles keep every spacing rule in relative units", () => {
  assert.match(READER_STYLES, /line-height: 1\.7/);
  assert.match(READER_STYLES, /p \{ margin: 0 0 2em; \}/);

  // Ini penjaga yang sebenarnya. Tinggi tetap dalam piksel adalah cara paling
  // umum merusak WCAG 1.4.12, karena teks yang jaraknya diperbesar pembaca
  // akan terpotong di dalam kotak yang tingginya dipaku.
  assert.equal(/height:\s*\d+px/.test(READER_STYLES), false, "tidak boleh ada tinggi tetap");
  assert.equal(/max-width:\s*\d+px/.test(READER_STYLES), false, "lebar maksimum harus rem");
});

test("reader styles never promise a dark mode that does not exist", () => {
  // Sebelumnya di sini tertulis color-scheme: light dark padahal palet gelapnya
  // tidak pernah dibuat. Test ini mencegahnya kembali tanpa palet.
  assert.match(READER_STYLES, /color-scheme: light;/);
  assert.equal(READER_STYLES.includes("light dark"), false);
});

test("reader styles let long addresses wrap instead of scrolling sideways", () => {
  assert.match(READER_STYLES, /overflow-wrap: break-word/);
});

test("the source link appears at the top and at the bottom", () => {
  const html = renderReaderDocument({
    title: "Halaman contoh",
    sourceUrl: "https://sulselprov.go.id/berita",
    siteLabel: "Sulselprov",
    disclaimer: DISCLAIMER,
    blocks: [{ type: "paragraph", text: "Isi singkat." }],
  });

  // Dua kali, bukan sekali. Pembaca yang sampai ke akhir halaman tidak boleh
  // dipaksa menggulir kembali ke atas hanya untuk memeriksa sumbernya.
  const jumlah = html.split("https://sulselprov.go.id/berita").length - 1;
  assert.ok(jumlah >= 2, `tautan sumber muncul ${jumlah} kali, harus minimal 2`);
  assert.match(html, /Buka halaman aslinya/);
});

test("the reader document carries the landmarks a screen reader navigates by", () => {
  const html = renderReaderDocument({
    title: "Halaman contoh",
    sourceUrl: "https://sulselprov.go.id/",
    disclaimer: DISCLAIMER,
    blocks: [],
  });

  // Pengguna NVDA menekan D untuk berpindah antar wilayah. Tanpa ketiga tag
  // ini, tombol itu tidak melakukan apa pun.
  assert.match(html, /<header>/);
  assert.match(html, /<main id="isi">/);
  assert.match(html, /<footer>/);
  assert.match(html, /<a class="lewati" href="#isi">/);
});
