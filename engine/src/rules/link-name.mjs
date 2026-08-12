export async function resolveLinkNameCandidates(
  page,
  selectors = [],
  config = {},
) {
  const siteLabel = config.siteLabel || "";
  const knownLinkLabels = config.knownLinkLabels || {};

  return page.evaluate(
    ({ selectors, siteLabel, knownLinkLabels }) => {
      const clean = (value = "") =>
        String(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

      const nearbyHeading = (element) => {
        const container = element.closest(
          "article, section, li, .card, .box, .info-box",
        );
        const heading = container?.querySelector(
          "h1, h2, h3, h4, h5, h6, [role='heading']",
        );
        const text = clean(heading?.textContent || "");
        return text.length <= 80 ? text : "";
      };

      return selectors.map((selector) => {
        let element;
        try {
          const matches = document.querySelectorAll(selector);
          if (matches.length !== 1) {
            return {
              rule: "link-name",
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
            rule: "link-name",
            selector,
            confidence: 0,
            source: "invalid-selector",
            reason: "Selector could not be evaluated",
            patches: [],
          };
        }

        const existingName =
          clean(element.innerText || "") ||
          clean(element.getAttribute("aria-label") || "") ||
          clean(element.getAttribute("title") || "") ||
          Array.from(element.querySelectorAll("img"))
            .map((image) => clean(image.getAttribute("alt") || ""))
            .filter(Boolean)
            .join(" ");

        if (existingName) {
          return {
            rule: "link-name",
            selector,
            confidence: 0,
            source: "existing-name",
            reason: "Element already has a name and will not be overwritten",
            patches: [],
          };
        }

        const href = element.getAttribute("href") || "";
        if (!href || href === "#" || href.toLowerCase().startsWith("javascript:")) {
          return {
            rule: "link-name",
            selector,
            confidence: 0,
            source: "unknown-destination",
            reason: "Link destination does not explain its purpose",
            patches: [],
          };
        }

        try {
          let url;

          if (/^https?:\/\//i.test(href)) {
            url = new URL(href);
          } else if (/^https?:\/\//i.test(document.baseURI)) {
            url = new URL(href, document.baseURI);
          } else {
            throw new Error("Relative URL has no valid HTTP base URL");
          }

          const host = url.hostname.replace(/^www\./, "").toLowerCase();
          const suffix = siteLabel ? ` ${siteLabel}` : "";
          const socialMappings = [
            ["instagram.com", `Buka Instagram${suffix}`],
            ["facebook.com", `Buka Facebook${suffix}`],
            ["youtube.com", `Buka YouTube${suffix}`],
            ["youtu.be", `Buka YouTube${suffix}`],
            ["tiktok.com", `Buka TikTok${suffix}`],
            ["x.com", `Buka X${suffix}`],
            ["twitter.com", `Buka X${suffix}`],
          ];

          const social = socialMappings.find(
            ([domain]) => host === domain || host.endsWith(`.${domain}`),
          );
          if (social) {
            return {
              rule: "link-name",
              selector,
              confidence: 0.95,
              source: "destination-domain",
              reason: "Recognized social destination",
              patches: [{ attribute: "aria-label", value: social[1] }],
            };
          }

          const pathname = decodeURIComponent(url.pathname).replace(/\/$/, "");
          const known = knownLinkLabels[pathname] || knownLinkLabels[href];
          if (known) {
            return {
              rule: "link-name",
              selector,
              confidence: 0.9,
              source: "known-link-map",
              reason: "Destination is present in the configured link map",
              patches: [{ attribute: "aria-label", value: known }],
            };
          }

          const heading = nearbyHeading(element);
          if (heading) {
            return {
              rule: "link-name",
              selector,
              confidence: 0.85,
              source: "nearby-heading",
              reason: "A nearby heading provides contextual purpose",
              patches: [
                { attribute: "aria-label", value: `Buka ${heading}` },
              ],
            };
          }

          const slug = clean(pathname.split("/").filter(Boolean).at(-1) || "");
          if (slug && slug.length <= 50 && !/^\d+$/.test(slug)) {
            return {
              rule: "link-name",
              selector,
              confidence: 0.65,
              source: "generic-url-slug",
              reason: "URL slug is only a suggestion and requires review",
              patches: [
                {
                  attribute: "aria-label",
                  value: `Buka ${slug.replace(/\b\w/g, (c) => c.toUpperCase())}`,
                },
              ],
            };
          }
        } catch {
          // Returned as unknown below.
        }

        return {
          rule: "link-name",
          selector,
          confidence: 0,
          source: "unknown-link",
          reason: "No reliable name source was found",
          patches: [],
        };
      });
    },
    { selectors, siteLabel, knownLinkLabels },
  );
}
