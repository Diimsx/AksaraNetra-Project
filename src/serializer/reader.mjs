import { absolutizeUrl, escapeHtml, normalizeLang } from "./sanitize.mjs";
import { dedupeHeadings } from "./blocks.mjs";

export const READER_TOKENS = Object.freeze({
  background: "#ffffff",
  surface: "#f4f6fb",
  text: "#1a1a1a",
  link: "#0b3d91",
  linkVisited: "#5b2a86",
  focus: "#b32d00",
  muted: "#3f3f3f",
  rule: "#767676",
});

export const READER_STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  --reader-bg: ${READER_TOKENS.background};
  --reader-surface: ${READER_TOKENS.surface};
  --reader-text: ${READER_TOKENS.text};
  --reader-link: ${READER_TOKENS.link};
  --reader-visited: ${READER_TOKENS.linkVisited};
  --reader-rule: ${READER_TOKENS.rule};
  background: var(--reader-bg);
  color: var(--reader-text);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0;
}
.reader-shell {
  font-size: 1.125rem;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 46rem;
  padding: 1.5rem 1.25rem 4rem;
}
a { color: var(--reader-link); }
a:visited { color: var(--reader-visited); }
:focus-visible {
  outline: 4px solid ${READER_TOKENS.focus};
  outline-offset: 2px;
}
.lewati {
  position: absolute;
  left: -9999px;
}
.lewati:focus {
  position: fixed;
  left: 1rem;
  top: 1rem;
  z-index: 10;
  background: #ffffff;
  color: #001e40;
  padding: 0.75rem 1rem;
}
.pengaturan {
  background: #edf1ff;
  color: #001e40;
  padding: 1rem;
}
.pengaturan > details { margin: 0 auto; max-width: 60rem; }
.pengaturan > details > summary {
  cursor: pointer;
  font-weight: 700;
  min-height: 2.75rem;
  padding: 0.6rem 0;
}
.pengaturan-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin: 0 auto;
  max-width: 60rem;
}
.pengaturan fieldset {
  border: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}
.pengaturan legend { font-weight: 700; margin-bottom: 0.35rem; }
.pengaturan label {
  align-items: center;
  background: #ffffff;
  border: 2px solid #9aa9c7;
  border-radius: 0.5rem;
  cursor: pointer;
  display: inline-flex;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
}
.pengaturan input { accent-color: #001e40; }
body:has(#teks-besar:checked) .reader-shell { font-size: 1.35rem; }
body:has(#teks-sangat-besar:checked) .reader-shell { font-size: 1.6rem; }
body:has(#jarak-lega:checked) .reader-shell { line-height: 2; }
body:has(#lebar-luas:checked) .reader-shell { max-width: 60rem; }
body:has(#tema-gelap:checked) {
  --reader-bg: #191919;
  --reader-surface: #292929;
  --reader-text: #ffffff;
  --reader-link: #8fc4ff;
  --reader-visited: #d0a6ff;
  --reader-rule: #b8b8b8;
}
body:has(#tema-kontras:checked) {
  --reader-bg: #000000;
  --reader-surface: #000000;
  --reader-text: #ffffff;
  --reader-link: #ffff00;
  --reader-visited: #00ffff;
  --reader-rule: #ffffff;
}
.pemberitahuan {
  border: 2px solid var(--reader-rule);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}
.sumber, .keterangan-gambar { color: var(--reader-text); }
img {
  display: block;
  height: auto;
  margin: 1.5rem auto;
  max-height: 24rem;
  max-width: 100%;
  border-radius: 0.5rem;
  object-fit: contain;
}
img[src*="logo" i],
img[alt*="logo" i],
img[src*="lambang" i] {
  max-height: 5.5rem;
  max-width: 16rem;
  margin: 1rem 0;
}
figure { margin: 2rem 0; }
figcaption, .keterangan-gambar { font-size: 0.95em; margin-top: 0.5rem; }
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin-top: 2rem; }
p { margin: 0 0 2em; }
li { margin-bottom: 0.5em; }
p, li, h1, h2, h3, h4, h5, h6, td, th { overflow-wrap: break-word; }
blockquote {
  border-inline-start: 0.3rem solid var(--reader-rule);
  margin: 2rem 0;
  padding: 0.5rem 1.25rem;
}
.navigasi-sumber, .detail-sumber {
  background: var(--reader-surface);
  border-radius: 0.75rem;
  margin: 1.5rem 0;
  padding: 1rem;
}
.navigasi-sumber summary, .detail-sumber summary {
  cursor: pointer;
  font-weight: 700;
  min-height: 2.75rem;
}
.table-scroll {
  margin: 2rem 0;
  overflow-x: auto;
}
table { border-collapse: collapse; min-width: 100%; }
caption { font-weight: 700; padding: 0.75rem; text-align: start; }
th, td { border: 1px solid var(--reader-rule); padding: 0.75rem; text-align: start; vertical-align: top; }
th { background: var(--reader-surface); }
@media (max-width: 36rem) {
  .reader-shell { padding-inline: 1rem; }
  .pengaturan-inner { display: block; }
  .pengaturan fieldset + fieldset { margin-top: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; }
}
`.trim();

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

function renderInlineParts(parts, fallbackText, baseUrl) {
  if (!Array.isArray(parts) || parts.length === 0) return escapeHtml(fallbackText);
  return parts
    .map((part) => {
      if (part?.type === "link") {
        const href = absolutizeUrl(part.href, baseUrl);
        const text = escapeHtml(part.text);
        return href && text.trim()
          ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${text}</a>`
          : text;
      }
      return escapeHtml(part?.text || "");
    })
    .join("")
    .trim();
}

function renderImage({ src, alt = "", caption = "" }, baseUrl, asFigure = false) {
  const source = absolutizeUrl(src, baseUrl, { image: true });
  if (!source) return "";
  const description = String(alt ?? "").trim();
  const image = description
    ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(description)}">`
    : `<img src="${escapeHtml(source)}" alt="" role="presentation">`;
  const note = description
    ? ""
    : `<p class="keterangan-gambar">Gambar ditampilkan tanpa deskripsi karena sumber tidak menyediakan teks alternatif.</p>`;
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
  return asFigure ? `<figure>${image}${figcaption}${note}</figure>` : `${image}${note}`;
}

function renderTable(block) {
  const rows = (block.rows || [])
    .map((row) => {
      const cells = row
        .map((cell) => {
          const tag = cell.header ? "th" : "td";
          const scope = cell.header && cell.scope ? ` scope="${escapeHtml(cell.scope)}"` : "";
          const colspan = cell.colspan > 1 ? ` colspan="${Number(cell.colspan)}"` : "";
          const rowspan = cell.rowspan > 1 ? ` rowspan="${Number(cell.rowspan)}"` : "";
          return `<${tag}${scope}${colspan}${rowspan}>${escapeHtml(cell.text)}</${tag}>`;
        })
        .join("");
      return cells ? `<tr>${cells}</tr>` : "";
    })
    .filter(Boolean)
    .join("");
  if (!rows) return "";
  const caption = escapeHtml(block.caption || "Tabel dari halaman sumber");
  return `<div class="table-scroll" role="region" aria-label="${caption}" tabindex="0"><table><caption>${caption}</caption><tbody>${rows}</tbody></table></div>`;
}

function renderBlock(block, baseUrl) {
  if (!block) return "";
  switch (block.type) {
    case "heading": {
      const text = escapeHtml(block.text);
      if (!text.trim()) return "";
      const href = block.href ? absolutizeUrl(block.href, baseUrl) : null;
      const inner = href
        ? `<a href="${escapeHtml(href)}">${text}</a>`
        : text;
      return `<h${block.level}>${inner}</h${block.level}>`;
    }
    case "paragraph": {
      const inner = renderInlineParts(block.parts, block.text, baseUrl);
      return inner ? `<p>${inner}</p>` : "";
    }
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = (block.items || [])
        .filter((item) => String(item ?? "").trim())
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return items ? `<${tag}>${items}</${tag}>` : "";
    }
    case "image":
      return renderImage(block, baseUrl, false);
    case "figure":
      return renderImage(block, baseUrl, true);
    case "quote": {
      const text = escapeHtml(block.text);
      if (!text) return "";
      const cite = absolutizeUrl(block.cite, baseUrl);
      return `<blockquote${cite ? ` cite="${escapeHtml(cite)}"` : ""}>${text}</blockquote>`;
    }
    case "table":
      return renderTable(block);
    case "details":
      return `<details class="detail-sumber"><summary>${escapeHtml(block.summary)}</summary><p>${escapeHtml(block.text)}</p></details>`;
    case "navigation": {
      const links = (block.links || [])
        .map((item) => {
          const href = absolutizeUrl(item.href, baseUrl);
          return href && item.text
            ? `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(item.text)}</a></li>`
            : "";
        })
        .filter(Boolean)
        .join("");
      return links
        ? `<details class="navigasi-sumber"><summary>${escapeHtml(block.label || "Navigasi halaman sumber")}</summary><nav aria-label="Navigasi dari halaman sumber"><ul>${links}</ul></nav></details>`
        : "";
    }
    case "link": {
      const href = absolutizeUrl(block.href, baseUrl);
      const text = escapeHtml(block.text);
      return href && text.trim()
        ? `<p><a href="${escapeHtml(href)}" rel="noopener noreferrer">${text}</a></p>`
        : "";
    }
    default:
      return "";
  }
}

function renderSettings() {
  return `<aside class="pengaturan" aria-label="Pengaturan tampilan bacaan">
<details>
<summary>Atur tampilan bacaan</summary>
<div class="pengaturan-inner">
<fieldset><legend>Ukuran teks</legend>
<label><input type="radio" name="teks" id="teks-normal" checked> Normal</label>
<label><input type="radio" name="teks" id="teks-besar"> Besar</label>
<label><input type="radio" name="teks" id="teks-sangat-besar"> Sangat besar</label>
</fieldset>
<fieldset><legend>Jarak dan lebar</legend>
<label><input type="checkbox" id="jarak-lega"> Jarak lebih lega</label>
<label><input type="checkbox" id="lebar-luas"> Kolom lebih lebar</label>
</fieldset>
<fieldset><legend>Tema</legend>
<label><input type="radio" name="tema" id="tema-terang" checked> Terang</label>
<label><input type="radio" name="tema" id="tema-gelap"> Gelap</label>
<label><input type="radio" name="tema" id="tema-kontras"> Kontras tinggi</label>
</fieldset>
</div>
</details>
</aside>`;
}

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

  const body = normalizeOutline(dedupeHeadings(blocks))
    .map((block) => renderBlock(block, safeSource))
    .filter(Boolean)
    .join("\n");
  const heading = escapeHtml(title || siteLabel || "Tampilan aksesibilitas");
  const asal = siteLabel ? escapeHtml(siteLabel) : escapeHtml(safeSource);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(normalizeLang(lang))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
<style>${READER_STYLES}</style>
</head>
<body>
<a class="lewati" href="#isi">Lewati ke isi utama</a>
${renderSettings()}
<div class="reader-shell">
<header>
<p class="pemberitahuan">${escapeHtml(disclaimer)}</p>
<h1>${heading}</h1>
<p class="sumber">Sumber: <a href="${escapeHtml(safeSource)}" rel="noopener noreferrer">${asal}</a></p>
</header>
<main id="isi">
${body}
</main>
<footer>
<p class="sumber"><a href="${escapeHtml(safeSource)}" rel="noopener noreferrer">Buka halaman aslinya</a></p>
</footer>
</div>
</body>
</html>
`;
}
