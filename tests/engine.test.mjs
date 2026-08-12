import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { remediatePage } from "../src/engine/index.mjs";
import { createRegressionReport } from "../src/engine/report.mjs";
import { getSiteConfig } from "../src/config/sites.mjs";

const fixture = (name) =>
  fs.readFileSync(path.resolve("tests/fixtures", name), "utf8");

async function withPage(html, callback) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await callback(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function axe(page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

test("fixes a recognized social link and skips an unknown link", async () => {
  await withPage(fixture("unnamed-links.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["link-name"],
      config: { siteLabel: "Sulselprov" },
    });

    assert.equal(
      await page.locator(".instagram").getAttribute("aria-label"),
      "Buka Instagram Sulselprov",
    );
    assert.equal(await page.locator(".unknown").getAttribute("aria-label"), null);
    assert.equal(result.fixed.length, 1);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.metrics.rules["link-name"].before, 2);
    assert.equal(result.metrics.rules["link-name"].after, 1);
  });
});

test("fixes carousel controls and reviews an ambiguous corner button", async () => {
  await withPage(fixture("unnamed-buttons.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["button-name"],
    });

    assert.equal(
      await page.locator(".left-2").getAttribute("aria-label"),
      "Media sebelumnya",
    );
    assert.equal(
      await page.locator(".right-2").getAttribute("aria-label"),
      "Media berikutnya",
    );
    assert.equal(await page.locator(".right-1").getAttribute("aria-label"), null);
    assert.equal(result.fixed.length, 2);
    assert.equal(result.review.length, 1);

    // Bukti posisi utility class saja tidak layak 0.95.
    for (const record of result.fixed) {
      assert.equal(record.confidence, 0.85);
      assert.equal(record.source, "carousel-position");
    }
    assert.equal(result.review[0].confidence, 0.75);
  });
});

test("names buttons from data attribute names and icon font classes", async () => {
  await withPage(fixture("data-attribute-buttons.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["button-name"],
    });

    assert.equal(
      await page.locator("[data-macro-prev]").getAttribute("aria-label"),
      "Konten sebelumnya",
    );
    assert.equal(
      await page.locator("[data-macro-next]").getAttribute("aria-label"),
      "Konten berikutnya",
    );
    assert.equal(
      await page.locator("#closeServiceModal").getAttribute("aria-label"),
      "Tutup",
    );

    assert.equal(result.fixed.length, 3);
    assert.equal(result.review.length, 0);
    assert.equal(result.metrics.rules["button-name"].after, 0);

    // Dua sinyal independen sepakat, jadi confidence naik ke 0.95.
    for (const record of result.fixed) {
      assert.equal(record.confidence, 0.95);
      assert.equal(record.source, "agreeing-signals");
      assert.ok(record.signals.length >= 2);
    }
  });
});

test("makes a reported scrollable region keyboard focusable", async () => {
  await withPage(fixture("scrollable-region.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["scrollable-region-focusable"],
    });

    const region = page.locator(".scrollable");
    assert.equal(await region.getAttribute("tabindex"), "0");
    assert.equal(await region.getAttribute("role"), "region");
    assert.equal(await region.getAttribute("aria-label"), "Area gulir Pengumuman");
    assert.equal(result.metrics.rules["scrollable-region-focusable"].after, 0);
    assert.equal(result.fixed[0].source, "preceding-heading");
  });
});

test("does not use an item heading inside the scroll area as the region name", async () => {
  await withPage(
    fixture("scrollable-region-nested-heading.html"),
    async (page) => {
      const before = await axe(page);
      const result = await remediatePage({
        page,
        axeResult: before,
        rules: ["scrollable-region-focusable"],
      });

      const region = page.locator(".scrollable");
      const label = await region.getAttribute("aria-label");

      assert.equal(await region.getAttribute("tabindex"), "0");
      assert.equal(label, "Daftar konten yang dapat digulir");
      assert.ok(!label.includes("49 Ruas Jalan"));
      assert.equal(result.fixed[0].source, "generic-scroll-region");
      assert.equal(result.fixed[0].confidence, 0.8);
      assert.equal(result.metrics.rules["scrollable-region-focusable"].after, 0);
    },
  );
});

test("a human verified label overrides the heuristic result", async () => {
  await withPage(fixture("unnamed-buttons.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["button-name"],
      config: {
        verifiedLabels: {
          ".right-1": {
            label: "Cari",
            note: "Tombol submit pencarian, dicek manual",
            verifiedOn: "2026-08-08",
          },
        },
      },
    });

    // Tombol yang tadinya masuk review sekarang punya nama yang dijamin manusia.
    assert.equal(await page.locator(".right-1").getAttribute("aria-label"), "Cari");
    assert.equal(result.fixed.length, 3);
    assert.equal(result.review.length, 0);
    assert.equal(result.metrics.rules["button-name"].after, 0);

    const override = result.fixed.find((record) => record.selector === ".right-1");
    assert.equal(override.confidence, 1);
    assert.equal(override.source, "verified-override");
    assert.equal(override.verifiedOn, "2026-08-08");

    // Jejak audit lama tidak boleh hilang.
    assert.equal(override.supersededSource, "corner-button-position");
    assert.equal(override.supersededConfidence, 0.75);

    // Confidence 1.0 hanya boleh lahir dari override manusia.
    for (const record of result.fixed) {
      if (record.source !== "verified-override") {
        assert.ok(record.confidence < 1);
      }
    }

    assert.deepEqual(result.staleOverrides, []);
  });
});

test("reports override selectors that no longer exist on the page", async () => {
  await withPage(fixture("unnamed-buttons.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["button-name"],
      config: {
        verifiedLabels: { ".tombol-yang-sudah-hilang": "Nama lama" },
      },
    });

    assert.deepEqual(result.staleOverrides, [".tombol-yang-sudah-hilang"]);
  });
});

test("warns when two patched elements end up with the same name", async () => {
  await withPage(fixture("unnamed-buttons.html"), async (page) => {
    const before = await axe(page);
    const result = await remediatePage({
      page,
      axeResult: before,
      rules: ["button-name"],
      config: {
        verifiedLabels: { ".left-2": "Geser", ".right-2": "Geser" },
      },
    });

    assert.equal(result.duplicateLabels.length, 1);
    assert.equal(result.duplicateLabels[0].label, "Geser");
    assert.equal(result.duplicateLabels[0].count, 2);

    // Nama kembar itu peringatan, bukan kegagalan. Patch tetap diterapkan.
    assert.equal(result.rolledBack, false);
    assert.equal(result.fixed.length, 2);

    // Tombol pojok tidak ikut di-override, jadi tetap masuk review dan
    // tetap terhitung sebagai pelanggaran yang belum selesai.
    assert.equal(result.review.length, 1);
    assert.equal(result.metrics.rules["button-name"].after, 1);
  });
});

test("regression report covers every rule, not only the target rules", () => {
  const before = {
    violations: [
      { id: "button-name", nodes: [{}, {}, {}] },
      { id: "color-contrast", nodes: [{}, {}] },
    ],
  };
  const after = {
    violations: [
      { id: "color-contrast", nodes: [{}, {}] },
      { id: "aria-allowed-attr", nodes: [{}] },
    ],
  };

  const report = createRegressionReport(before, after);

  assert.equal(report.rules["button-name"].delta, -3);
  assert.equal(report.rules["color-contrast"].delta, 0);
  assert.equal(report.rules["aria-allowed-attr"].delta, 1);

  // Rule baru yang muncul setelah patch harus ketahuan.
  assert.equal(report.clean, false);
  assert.deepEqual(report.newViolationRules, ["aria-allowed-attr"]);

  const cleanReport = createRegressionReport(before, {
    violations: [{ id: "color-contrast", nodes: [{}, {}] }],
  });
  assert.equal(cleanReport.clean, true);
  assert.deepEqual(cleanReport.worsened, []);
});

test("keeps site specific labels out of the core engine", () => {
  const sulsel = getSiteConfig("https://sulselprov.go.id/berita");
  const kepri = getSiteConfig("https://www.kepriprov.go.id");
  const unknown = getSiteConfig("https://contoh-situs-belum-terdaftar.go.id");

  assert.equal(sulsel.siteLabel, "Sulselprov");
  assert.equal(sulsel.configured, true);
  assert.equal(kepri.siteLabel, "Kepriprov");
  assert.equal(kepri.matchedHost, "kepriprov.go.id");

  // Situs yang belum terdaftar tetap boleh diproses, hanya tanpa label khusus.
  assert.equal(unknown.configured, false);
  assert.equal(unknown.siteLabel, "");
  assert.deepEqual(unknown.knownLinkLabels, {});
  assert.deepEqual(unknown.verifiedLabels, {});

  // Setiap override wajib punya catatan alasan dan tanggal pemeriksaan.
  for (const [selector, entry] of Object.entries(sulsel.verifiedLabels)) {
    assert.ok(entry.label, `${selector} harus punya label`);
    assert.ok(entry.note, `${selector} harus punya note`);
    assert.ok(entry.verifiedOn, `${selector} harus punya verifiedOn`);
  }

  const coreFiles = [
    "src/rules/button-name.mjs",
    "src/rules/link-name.mjs",
    "src/rules/scrollable-region.mjs",
    "src/engine/index.mjs",
    "src/engine/verified-labels.mjs",
  ];

  for (const file of coreFiles) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    assert.ok(!/sulselprov/i.test(source), `${file} menyebut nama situs`);
    assert.ok(!/kepriprov/i.test(source), `${file} menyebut nama situs`);
  }
});

test("makes a scrollable region with tabindex minus one reachable by Tab", async () => {
  await withPage(
    `<!doctype html><html lang="id"><title>Uji</title><body><main><div id="area" tabindex="-1" style="overflow:auto;width:100px"><div style="width:500px">Isi yang panjang</div></div></main></body></html>`,
    async (page) => {
      const before = await axe(page);
      const result = await remediatePage({
        page,
        axeResult: before,
        rules: ["scrollable-region-focusable"],
      });

      assert.equal(await page.locator("#area").getAttribute("tabindex"), "0");
      assert.equal(result.fixed.length, 1);
      assert.equal(result.fixed[0].status, "verified-fixed");
      assert.equal(result.rolledBackRecords.length, 0);
    },
  );
});
