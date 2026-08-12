/**
 * Resolver scrollable-region-focusable.
 *
 * Perubahan penting dibanding 0.1.1:
 * heading yang berada DI DALAM area gulir tidak lagi dipakai sebagai nama
 * region. Pada daftar berita, heading pertama di dalam container adalah judul
 * item pertama, bukan nama sectionnya, sehingga label yang dihasilkan
 * menyesatkan bagi pengguna screen reader.
 *
 * Sekarang engine hanya menerima heading yang MENDAHULUI area gulir, dan
 * membatasi panjangnya. Bila tidak ada, engine memakai label generik yang
 * jujur, bukan menebak.
 */
const MAX_HEADING_LENGTH = 60;

export async function resolveScrollableRegionCandidates(
  page,
  selectors = [],
  config = {},
) {
  const maxHeadingLength = config.maxHeadingLength || MAX_HEADING_LENGTH;

  return page.evaluate(
    ({ selectors, maxHeadingLength }) => {
      const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, [role='heading']";
      // Batas naik. Heading milik section tetangga bukan nama area gulir ini.
      const SECTION_BOUNDARY =
        "section, article, main, aside, nav, [role='region'], [role='main']";
      const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();

      const precedingHeading = (element) => {
        let node = element;
        let hops = 0;

        while (node && node !== document.body && hops < 5) {
          // Berhenti begitu sampai di akar section, jangan mengintip keluar.
          if (node !== element && node.matches?.(SECTION_BOUNDARY)) break;

          let sibling = node.previousElementSibling;

          while (sibling) {
            const found = [];
            if (sibling.matches?.(HEADING_SELECTOR)) found.push(sibling);
            found.push(...sibling.querySelectorAll(HEADING_SELECTOR));

            // Yang terdekat dengan area gulir berada paling akhir.
            for (const heading of found.reverse()) {
              if (element.contains(heading)) continue;
              const text = clean(heading.textContent || "");
              if (text && text.length <= maxHeadingLength) return text;
            }

            sibling = sibling.previousElementSibling;
          }

          node = node.parentElement;
          hops += 1;
        }

        return "";
      };

      return selectors.map((selector) => {
        let element;
        try {
          const matches = document.querySelectorAll(selector);
          if (matches.length !== 1) {
            return {
              rule: "scrollable-region-focusable",
              selector,
              confidence: 0,
              source: "selector-not-unique",
              reason: `Selector matched ${matches.length} elements`,
              patches: [],
            };
          }
          element = matches[0];
        } catch {
          return {
            rule: "scrollable-region-focusable",
            selector,
            confidence: 0,
            source: "invalid-selector",
            reason: "Selector could not be evaluated",
            patches: [],
          };
        }

        const style = getComputedStyle(element);
        const actuallyScrollable =
          ((style.overflowY === "auto" || style.overflowY === "scroll") &&
            element.scrollHeight > element.clientHeight) ||
          ((style.overflowX === "auto" || style.overflowX === "scroll") &&
            element.scrollWidth > element.clientWidth);

        if (!actuallyScrollable) {
          return {
            rule: "scrollable-region-focusable",
            selector,
            confidence: 0,
            source: "not-currently-scrollable",
            reason: "Element is not scrollable in the current rendered state",
            patches: [],
          };
        }

        const ownLabel = clean(element.getAttribute("aria-label") || "");
        const headingText = ownLabel ? "" : precedingHeading(element);
        const nameSource = ownLabel || headingText;
        const label = nameSource
          ? `Area gulir ${nameSource}`
          : "Daftar konten yang dapat digulir";

        const patches = [];
        if (!element.hasAttribute("tabindex")) {
          patches.push({ attribute: "tabindex", value: "0" });
        }
        if (!element.hasAttribute("role")) {
          patches.push({ attribute: "role", value: "region" });
        }
        if (
          !element.hasAttribute("aria-label") &&
          !element.hasAttribute("aria-labelledby")
        ) {
          patches.push({ attribute: "aria-label", value: label });
        }

        return {
          rule: "scrollable-region-focusable",
          selector,
          confidence: headingText ? 0.9 : 0.8,
          source: headingText ? "preceding-heading" : "generic-scroll-region",
          reason: headingText
            ? "A heading before the region describes its content"
            : "Scrollable content needs keyboard focus, but no section heading was found before it",
          patches,
        };
      });
    },
    { selectors, maxHeadingLength },
  );
}
