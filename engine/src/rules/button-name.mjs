/**
 * Resolver button-name.
 *
 * Prinsip: engine tidak menebak nama tombol. Engine hanya membaca sinyal yang
 * benar-benar ada di HTML, lalu menaikkan confidence bila lebih dari satu
 * sinyal independen sepakat pada aksi yang sama.
 *
 * Sinyal yang dibaca, semuanya generik dan tidak terikat nama situs:
 *   1. Nilai atribut data-action atau data-command
 *   2. Nama atribut data-* yang berakhiran kata aksi, misal data-macro-prev
 *   3. Nama ikon dari library populer, misal ph-caret-left atau lucide-x
 *   4. Token pada id atau class tombol, misal id="closeServiceModal"
 *   5. Posisi kontrol carousel berbasis utility class
 *
 * Kata "left" dan "right" sengaja TIDAK dianggap kata aksi pada sinyal 2 dan 4,
 * karena class posisi seperti "right-1" tidak menjelaskan fungsi tombol.
 * Arah hanya bermakna bila datang dari nama ikon.
 */
export async function resolveButtonNameCandidates(
  page,
  selectors = [],
  config = {},
) {
  const buttonLabels = config.buttonLabels || {};
  const mediaButtonLabels = config.mediaButtonLabels || {};

  return page.evaluate(
    ({ selectors, buttonLabels, mediaButtonLabels }) => {
      const clean = (value = "") =>
        String(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

      const GENERIC_LABELS = {
        next: "Konten berikutnya",
        previous: "Konten sebelumnya",
        close: "Tutup",
        search: "Buka pencarian",
        menu: "Buka menu",
        ...buttonLabels,
      };

      const MEDIA_LABELS = {
        next: "Media berikutnya",
        previous: "Media sebelumnya",
        ...mediaButtonLabels,
      };

      // Kata aksi eksplisit. Sengaja tanpa "left" dan "right".
      const ACTION_WORDS = {
        next: "next",
        forward: "next",
        prev: "previous",
        previous: "previous",
        back: "previous",
        close: "close",
        dismiss: "close",
        search: "search",
        find: "search",
        menu: "menu",
        hamburger: "menu",
      };

      const ICON_PREFIXES = [
        "ph",
        "fa",
        "fas",
        "far",
        "fab",
        "fal",
        "bi",
        "lucide",
        "mdi",
        "bx",
        "bxs",
        "ion",
        "eva",
        "ti",
        "icon",
        "glyphicon",
      ];

      const stripIconModifier = (token) =>
        token.replace(
          /-(lg|sm|xs|md|xl|fill|bold|regular|light|thin|duotone|solid|outline)$/,
          "",
        );

      // Nama ikon boleh directional, karena panah kiri di dalam tombol tanpa
      // nama memang bermakna "sebelumnya".
      const iconAction = (rawToken) => {
        const token = stripIconModifier(rawToken);
        if (ACTION_WORDS[token]) return ACTION_WORDS[token];
        if (/(^|-)left$/.test(token)) return "previous";
        if (/(^|-)right$/.test(token)) return "next";
        if (/(^|-)(x|xmark|times|close|remove)$/.test(token)) return "close";
        if (/(^|-)(search|magnifying-glass|magnifier)$/.test(token)) {
          return "search";
        }
        if (/(^|-)(menu|bars|list|hamburger)$/.test(token)) return "menu";
        return "";
      };

      const collectIconActions = (element) => {
        const found = new Set();
        const nodes = [element, ...element.querySelectorAll("*")];

        for (const node of nodes) {
          const lucide = String(node.getAttribute?.("data-lucide") || "")
            .trim()
            .toLowerCase();
          if (lucide) {
            const action = iconAction(lucide);
            if (action) found.add(action);
          }

          const classAttribute = String(
            node.getAttribute?.("class") || "",
          ).toLowerCase();
          if (!classAttribute) continue;

          for (const cls of classAttribute.split(/\s+/)) {
            const separator = cls.indexOf("-");
            if (separator <= 0) continue;
            const prefix = cls.slice(0, separator);
            if (!ICON_PREFIXES.includes(prefix)) continue;
            const action = iconAction(cls.slice(separator + 1));
            if (action) found.add(action);
          }
        }

        return [...found];
      };

      // Memecah camelCase supaya id seperti closeServiceModal terbaca.
      const identifierActions = (element) => {
        const raw = `${element.getAttribute("id") || ""} ${
          element.getAttribute("class") || ""
        }`;
        const tokens = raw
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(Boolean);

        const found = new Set();
        for (const token of tokens) {
          if (ACTION_WORDS[token]) found.add(ACTION_WORDS[token]);
        }
        return [...found];
      };

      const dataNameActions = (element) => {
        const found = new Set();
        for (const name of element.getAttributeNames()) {
          if (!name.startsWith("data-")) continue;
          if (name.startsWith("data-project-a-")) continue;
          if (name === "data-action" || name === "data-command") continue;

          const lastWord = name.slice(5).split("-").pop();
          if (ACTION_WORDS[lastWord]) found.add(ACTION_WORDS[lastWord]);
        }
        return [...found];
      };

      const SINGLE_SIGNAL_CONFIDENCE = {
        "data-action-value": 0.9,
        "data-attribute-name": 0.9,
        "recognized-icon": 0.85,
        "element-identifier": 0.85,
        "carousel-position": 0.85,
      };

      const skip = (selector, source, reason) => ({
        rule: "button-name",
        selector,
        confidence: 0,
        source,
        reason,
        patches: [],
      });

      return selectors.map((selector) => {
        let element;
        try {
          const matches = document.querySelectorAll(selector);
          if (matches.length !== 1) {
            return skip(
              selector,
              "selector-not-unique",
              `Selector matched ${matches.length} elements`,
            );
          }
          element = matches[0];
        } catch {
          return skip(
            selector,
            "invalid-selector",
            "Selector could not be evaluated",
          );
        }

        const existingName =
          clean(element.innerText || "") ||
          clean(element.getAttribute("aria-label") || "") ||
          clean(element.getAttribute("title") || "");

        if (existingName) {
          return skip(
            selector,
            "existing-name",
            "Element already has a name and will not be overwritten",
          );
        }

        const signals = [];

        const actionValue = clean(
          element.getAttribute("data-action") ||
            element.getAttribute("data-command") ||
            "",
        ).toLowerCase();
        if (ACTION_WORDS[actionValue]) {
          signals.push({
            source: "data-action-value",
            action: ACTION_WORDS[actionValue],
          });
        }

        for (const action of dataNameActions(element)) {
          signals.push({ source: "data-attribute-name", action });
        }

        for (const action of collectIconActions(element)) {
          signals.push({ source: "recognized-icon", action });
        }

        for (const action of identifierActions(element)) {
          signals.push({ source: "element-identifier", action });
        }

        const className = String(element.getAttribute("class") || "")
          .toLowerCase();
        const isCarouselPrevious =
          className.includes("left-2") && className.includes("top-1/2");
        const isCarouselNext =
          className.includes("right-2") && className.includes("top-1/2");

        if (isCarouselPrevious) {
          signals.push({ source: "carousel-position", action: "previous" });
        }
        if (isCarouselNext) {
          signals.push({ source: "carousel-position", action: "next" });
        }

        if (signals.length) {
          const tally = new Map();
          for (const signal of signals) {
            const entry = tally.get(signal.action) || { sources: new Set() };
            entry.sources.add(signal.source);
            tally.set(signal.action, entry);
          }

          const ranked = [...tally.entries()].sort(
            (a, b) => b[1].sources.size - a[1].sources.size,
          );
          const [winningAction, winningEntry] = ranked[0];
          const tied =
            ranked.length > 1 &&
            ranked[1][1].sources.size === winningEntry.sources.size;

          const sources = [...winningEntry.sources].sort();
          const mediaContext = sources.includes("carousel-position");
          const labels =
            mediaContext && MEDIA_LABELS[winningAction]
              ? MEDIA_LABELS
              : GENERIC_LABELS;
          const label = labels[winningAction] || GENERIC_LABELS[winningAction];

          if (!label) {
            return skip(
              selector,
              "unknown-button",
              "Recognized an action without a configured label",
            );
          }

          if (tied) {
            return {
              rule: "button-name",
              selector,
              confidence: 0.6,
              source: "conflicting-signals",
              reason:
                "Two different actions were detected with equal support, so a human should decide",
              signals: [...new Set(signals.map((signal) => signal.source))].sort(),
              detectedActions: ranked.map(([action, entry]) => ({
                action,
                sources: [...entry.sources].sort(),
              })),
              patches: [{ attribute: "aria-label", value: label }],
            };
          }

          const confidence =
            sources.length >= 2
              ? 0.95
              : SINGLE_SIGNAL_CONFIDENCE[sources[0]] ?? 0.8;

          return {
            rule: "button-name",
            selector,
            confidence,
            source: sources.length >= 2 ? "agreeing-signals" : sources[0],
            reason:
              sources.length >= 2
                ? `Independent signals agree on "${winningAction}": ${sources.join(", ")}`
                : `Single signal identifies "${winningAction}" from ${sources[0]}`,
            signals: sources,
            patches: [{ attribute: "aria-label", value: label }],
          };
        }

        if (className.includes("right-1") && className.includes("top-1")) {
          return {
            rule: "button-name",
            selector,
            confidence: 0.75,
            source: "corner-button-position",
            reason: "Likely a close button, but position alone is not conclusive",
            signals: ["corner-button-position"],
            patches: [
              { attribute: "aria-label", value: GENERIC_LABELS.close },
            ],
          };
        }

        return skip(
          selector,
          "unknown-button",
          "No reliable action source was found",
        );
      });
    },
    { selectors, buttonLabels, mediaButtonLabels },
  );
}
