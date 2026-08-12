import {
  SNAPSHOT_CSP,
  STRIPPED_TAGS,
  absolutizeUrl,
  escapeHtml,
  isDangerousAttribute,
  normalizeLang,
  sanitizeInlineStyle,
} from "./sanitize.mjs";
import { renderReaderDocument } from "./reader.mjs";
import { MAX_CARD_LEVELS, attachCardLinks } from "./blocks.mjs";

async function extract(page, strippedTags, maxCardLevels) {
  return page.evaluate(({ tags, maxCardLevels: levelLimit }) => {
    const doc = document.cloneNode(true);
    const baseUrl = document.baseURI;
    const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();

    for (const tag of tags) {
      for (const node of doc.querySelectorAll(tag)) node.remove();
    }

    for (const meta of doc.querySelectorAll("meta[http-equiv]")) meta.remove();
    for (const link of doc.querySelectorAll("link[rel~='stylesheet']")) link.remove();
    for (const style of doc.querySelectorAll("style")) {
      if (/@import|javascript\s*:|vbscript\s*:|expression\s*\(|url\s*\(/i.test(style.textContent || "")) {
        style.remove();
      }
    }

    const safeUrl = (value, image = false) => {
      const raw = String(value || "").trim();
      if (!raw) return null;
      if (!image && raw.startsWith("#")) return raw;
      if (raw.toLowerCase().startsWith("data:")) {
        return image && /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(raw)
          ? raw
          : null;
      }
      try {
        const parsed = new URL(raw, baseUrl);
        if (image) {
          return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? parsed.toString()
            : null;
        }
        return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)
          ? parsed.toString()
          : null;
      } catch {
        return null;
      }
    };

    for (const node of doc.querySelectorAll("*")) {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        const dangerous =
          name.startsWith("on") ||
          ["srcdoc", "ping", "formaction", "http-equiv", "xlink:href", "integrity", "nonce"].includes(name);
        if (dangerous) {
          node.removeAttribute(attribute.name);
          continue;
        }
        if (name === "style") {
          const value = attribute.value;
          if (/expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|@import|url\s*\(/i.test(value)) {
            node.removeAttribute(attribute.name);
          }
        }
      }
    }

    for (const form of doc.querySelectorAll("form")) {
      form.removeAttribute("action");
      form.removeAttribute("method");
      form.setAttribute("data-aksara-dinonaktifkan", "true");
    }

    for (const node of doc.querySelectorAll("[href], [src], [srcset]")) {
      if (node.hasAttribute("href")) {
        const safe = safeUrl(node.getAttribute("href"), false);
        if (safe) node.setAttribute("href", safe);
        else node.removeAttribute("href");
      }
      if (node.hasAttribute("src")) {
        const safe = safeUrl(node.getAttribute("src"), true);
        if (safe) node.setAttribute("src", safe);
        else node.removeAttribute("src");
      }
      node.removeAttribute("srcset");
      if (node.getAttribute("target") === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    }

    const HEADINGS = "h1, h2, h3, h4, h5, h6";

    function collectCardLinks(element) {
      const levels = [];
      let parent = element.parentElement;
      for (let depth = 0; depth < levelLimit; depth += 1) {
        if (!parent || parent === doc.body) break;
        levels.push(
          [...parent.querySelectorAll("a[href]")]
            .map((anchor) => ({
              href: anchor.getAttribute("href") || "",
              text: clean(anchor.textContent),
            }))
            .filter((item) => item.href && !item.href.startsWith("#")),
        );
        parent = parent.parentElement;
      }
      return levels;
    }

    function inlineParts(element) {
      const parts = [];
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) parts.push({ type: "text", text: node.textContent });
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        if (tag === "a") {
          const text = clean(node.textContent);
          const href = node.getAttribute("href");
          if (text) parts.push({ type: "link", text, href });
          return;
        }
        if (tag === "br") {
          parts.push({ type: "text", text: "\n" });
          return;
        }
        for (const child of node.childNodes) walk(child);
      };
      for (const child of element.childNodes) walk(child);
      return parts;
    }

    const seenText = new Set();
    const seenLink = new Set();
    const blocks = [];
    const root = doc.body || doc.documentElement;
    const selector = [
      HEADINGS,
      "p",
      "ul",
      "ol",
      "blockquote",
      "table",
      "figure",
      "details",
      "nav",
      "img",
      "a[href]",
    ].join(", ");

    for (const node of root.querySelectorAll(selector)) {
      const tag = node.tagName.toLowerCase();
      if (node.closest("nav") && tag !== "nav") continue;
      if (node.closest("table") && tag !== "table") continue;
      if (node.closest("figure") && tag !== "figure") continue;
      if (node.closest("blockquote") && tag !== "blockquote") continue;
      if (node.closest("details") && tag !== "details") continue;
      if ((tag === "p" || tag === "a") && node.closest("li")) continue;

      if (tag === "nav") {
        const links = [...node.querySelectorAll("a[href]")]
          .map((anchor) => ({
            text: clean(anchor.textContent),
            href: anchor.getAttribute("href"),
          }))
          .filter((item) => item.text && item.href);
        if (links.length) {
          blocks.push({
            type: "navigation",
            label: clean(node.getAttribute("aria-label")) || "Navigasi halaman sumber",
            links,
          });
        }
        continue;
      }

      if (/^h[1-6]$/.test(tag)) {
        const text = clean(node.textContent);
        if (!text) continue;
        const anchor = node.closest("a[href]") || node.querySelector("a[href]");
        const href = anchor ? anchor.getAttribute("href") : null;
        seenText.add(text);
        if (href) seenLink.add(`${href}|${text}`);
        blocks.push({
          type: "heading",
          level: Number(tag[1]),
          text,
          href,
          cardLinks: href ? null : collectCardLinks(node),
        });
        continue;
      }

      if (tag === "p") {
        const text = clean(node.textContent);
        if (text.length > 1 && !seenText.has(text)) {
          seenText.add(text);
          blocks.push({ type: "paragraph", text, parts: inlineParts(node) });
        }
        continue;
      }

      if (tag === "blockquote") {
        const text = clean(node.textContent);
        if (text) blocks.push({ type: "quote", text, cite: node.getAttribute("cite") });
        continue;
      }

      if (tag === "table") {
        const rows = [...node.querySelectorAll("tr")]
          .map((row) =>
            [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) => ({
              text: clean(cell.textContent),
              header: cell.tagName.toLowerCase() === "th",
              scope: cell.getAttribute("scope") || null,
              colspan: Number(cell.getAttribute("colspan") || 1),
              rowspan: Number(cell.getAttribute("rowspan") || 1),
            })),
          )
          .filter((row) => row.length);
        if (rows.length) {
          blocks.push({
            type: "table",
            caption: clean(node.querySelector("caption")?.textContent) || "Tabel dari halaman sumber",
            rows,
          });
        }
        continue;
      }

      if (tag === "figure") {
        const image = node.querySelector("img[src]");
        if (!image) continue;
        const width = Number(image.getAttribute("width") || 0);
        const height = Number(image.getAttribute("height") || 0);
        if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) continue;
        blocks.push({
          type: "figure",
          src: image.getAttribute("src"),
          alt: image.getAttribute("alt") || "",
          caption: clean(node.querySelector("figcaption")?.textContent),
        });
        continue;
      }

      if (tag === "details") {
        const summary = clean(node.querySelector(":scope > summary")?.textContent) || "Detail dari halaman sumber";
        const clone = node.cloneNode(true);
        clone.querySelector(":scope > summary")?.remove();
        const text = clean(clone.textContent);
        if (text) blocks.push({ type: "details", summary, text });
        continue;
      }

      if (tag === "img") {
        const src = node.getAttribute("src");
        const width = Number(node.getAttribute("width") || node.naturalWidth || 0);
        const height = Number(node.getAttribute("height") || node.naturalHeight || 0);
        if (!src || (width > 0 && width <= 2) || (height > 0 && height <= 2)) continue;
        blocks.push({ type: "image", src, alt: node.getAttribute("alt") || "" });
        continue;
      }

      if (tag === "a") {
        if (node.querySelector(HEADINGS) || node.closest("p")) continue;
        const text = clean(node.textContent);
        const href = node.getAttribute("href");
        if (!href || text.length < 2) continue;
        const key = `${href}|${text}`;
        if (seenText.has(text) || seenLink.has(key)) continue;
        seenLink.add(key);
        seenText.add(text);
        blocks.push({ type: "link", text, href });
        continue;
      }

      const items = [...node.children]
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => clean(child.textContent))
        .filter(Boolean);
      if (items.length) blocks.push({ type: "list", ordered: tag === "ol", items });
    }

    return {
      html: doc.documentElement.outerHTML,
      lang: doc.documentElement.getAttribute("lang") || "id",
      title: doc.title || "",
      blocks,
    };
  }, { tags: strippedTags, maxCardLevels });
}

function wrapPatchedPage({ html, disclaimer, sourceUrl }) {
  const banner =
    `<div style="background:#ffffff;color:#1a1a1a;border-bottom:3px solid #767676;` +
    `padding:12px 16px;font:16px/1.6 system-ui,sans-serif">` +
    `${escapeHtml(disclaimer)} ` +
    `<a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer" style="color:#0b3d91">Buka halaman aslinya</a>` +
    `</div>`;
  const head = `<meta http-equiv="Content-Security-Policy" content="${SNAPSHOT_CSP}">`;
  let output = html.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  output = output.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
  return `<!DOCTYPE html>\n${output}`;
}

export async function serializePage({ page, sourceUrl, siteLabel = null, disclaimer }) {
  const extracted = await extract(page, STRIPPED_TAGS, MAX_CARD_LEVELS);
  const blocks = attachCardLinks(extracted.blocks);
  const safeSource = absolutizeUrl(sourceUrl, sourceUrl);
  if (!safeSource) throw new Error("sourceUrl tidak aman untuk serializer.");

  return {
    patchedPage: wrapPatchedPage({
      html: extracted.html,
      disclaimer,
      sourceUrl: safeSource,
    }),
    readerView: renderReaderDocument({
      title: extracted.title,
      lang: normalizeLang(extracted.lang),
      sourceUrl: safeSource,
      siteLabel,
      disclaimer,
      blocks,
    }),
    blockCount: blocks.length,
  };
}
