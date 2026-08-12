import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FAILURE_MESSAGES,
  MIN_HOST_INTERVAL_MS,
  STAGES,
  auditUrl,
  messageForCode,
  nextAllowedDelay,
  recordRequest,
} from "../src/api/index.mjs";

/**
 * Laporan tiruan yang bentuknya sama dengan keluaran src/runner.
 *
 * Dipakai supaya urutan langkah bisa diuji tanpa browser dan tanpa jaringan.
 */
function fakeReport(url = "https://contoh.go.id/") {
  return {
    engineVersion: "0.0.0-test",
    page: {
      requestedUrl: url,
      finalUrl: url,
      status: 200,
      title: "Contoh Halaman",
      testedAt: "2026-08-09T00:00:00.000Z",
    },
    siteConfig: {
      host: "contoh.go.id",
      matchedHost: null,
      configured: false,
      siteLabel: "Contoh",
    },
    metrics: {
      beforeTotal: 4,
      afterTotal: 1,
      reduction: 3,
      reductionPercent: 75,
      strictImprovement: true,
      noRegression: true,
      rules: {},
    },
    fixed: [],
    review: [],
    skipped: [],
  };
}

/**
 * Kumpulan dependency tiruan yang mencatat urutan pemanggilan.
 */
function createFakeDeps(overrides = {}) {
  const calls = [];

  const deps = {
    resolveHost: async () => {
      calls.push("resolveHost");
      return ["93.184.216.34"];
    },
    fetchRobots: async () => {
      calls.push("fetchRobots");
      // Status 404 berarti robots.txt tidak ada, dan itu artinya boleh lanjut.
      return { status: 404, text: "" };
    },
    withBrowser: async (task) => {
      calls.push("openBrowser");
      try {
        return await task({ page: { fake: true } });
      } finally {
        calls.push("closeBrowser");
      }
    },
    attachGuard: async () => {
      calls.push("attachGuard");
      return {
        allowed: 12,
        blocked: 5,
        byType: { script: { allowed: 0, blocked: 5 } },
        blockedHosts: ["cdn.contoh.go.id"],
      };
    },
    auditPage: async () => {
      calls.push("auditPage");
      const report = fakeReport();
      return { report, siteConfig: report.siteConfig, artifacts: {} };
    },
    serializePage: async () => {
      calls.push("serializePage");
      return {
        patchedPage: "<html>patched</html>",
        readerView: "<html>reader</html>",
        blockCount: 9,
      };
    },
    writeSnapshot: () => {
      calls.push("writeSnapshot");
      return "folder-tiruan";
    },
    now: () => 1_000_000,
    sleep: async (ms) => {
      calls.push(`sleep:${ms}`);
    },
    ...overrides,
  };

  return { calls, deps };
}

test("turns every failure code into a sentence a person can read", () => {
  for (const [code, message] of Object.entries(FAILURE_MESSAGES)) {
    assert.equal(typeof message, "string", `${code} harus punya pesan`);
    assert.ok(message.length > 20, `${code} pesannya terlalu pendek`);
    assert.ok(message.endsWith("."), `${code} pesannya harus kalimat utuh`);
    // Pesan untuk manusia tidak boleh berisi kode mentah.
    assert.equal(message.includes(code), false, `${code} bocor ke dalam pesan`);
  }
});

test("never leaves an unknown code without an explanation", () => {
  const message = messageForCode("kode-yang-belum-pernah-ada");
  assert.equal(typeof message, "string");
  assert.ok(message.length > 20);
  assert.equal(message.includes("undefined"), false);
});

test("puts the technical detail after the plain sentence, not instead of it", () => {
  const message = messageForCode("status-not-ok", "HTTP 503");
  assert.ok(message.startsWith(FAILURE_MESSAGES["status-not-ok"]));
  assert.ok(message.includes("HTTP 503"));
});

test("does not wait for a host it has never visited", () => {
  const history = new Map();
  assert.equal(nextAllowedDelay({ host: "contoh.go.id", now: 5000, history }), 0);
});

test("waits out the remaining time when the same host was just visited", () => {
  const history = new Map();
  recordRequest({ host: "contoh.go.id", now: 10_000, history });

  const delay = nextAllowedDelay({ host: "contoh.go.id", now: 12_000, history });
  assert.equal(delay, MIN_HOST_INTERVAL_MS - 2000);
});

test("stops waiting once enough time has passed", () => {
  const history = new Map();
  recordRequest({ host: "contoh.go.id", now: 10_000, history });

  assert.equal(
    nextAllowedDelay({ host: "contoh.go.id", now: 10_000 + MIN_HOST_INTERVAL_MS, history }),
    0,
  );
});

test("waits a full interval when the clock moves backwards", () => {
  const history = new Map();
  recordRequest({ host: "contoh.go.id", now: 10_000, history });

  // Jam sistem bisa dikoreksi ke belakang. Jeda negatif akan membuat batas laju
  // hilang tanpa ada yang sadar.
  assert.equal(
    nextAllowedDelay({ host: "contoh.go.id", now: 9000, history }),
    MIN_HOST_INTERVAL_MS,
  );
});

test("counts the rate limit per host, not for the whole run", () => {
  const history = new Map();
  recordRequest({ host: "satu.go.id", now: 10_000, history });

  assert.equal(nextAllowedDelay({ host: "dua.go.id", now: 10_100, history }), 0);
});

test("runs every step in the required order", async () => {
  const { calls, deps } = createFakeDeps();

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    origin: "catalog",
    outputDir: "folder-tiruan",
    id: "contoh",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, true, result.message);
  assert.deepEqual(calls, [
    "resolveHost",
    "fetchRobots",
    "openBrowser",
    "attachGuard",
    "auditPage",
    "serializePage",
    "closeBrowser",
    "writeSnapshot",
  ]);
});

test("reports honest monotonic milestones for the job API", async () => {
  const { deps } = createFakeDeps();
  const updates = [];
  const result = await auditUrl({
    url: "https://contoh.go.id/",
    outputDir: "folder-tiruan",
    deps,
    history: new Map(),
    onProgress: (update) => updates.push(update),
  });

  assert.equal(result.ok, true, result.message);
  assert.ok(updates.length >= 7);
  assert.equal(updates[0].progress, 2);
  assert.equal(updates.at(-1).progress, 94);
  assert.ok(updates.every((item) => item.stage.length > 5));
  assert.deepEqual(
    updates.map((item) => item.progress),
    [...updates.map((item) => item.progress)].sort((a, b) => a - b),
  );
});

test("puts the guard numbers into the snapshot without changing its old shape", async () => {
  const { deps } = createFakeDeps();

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.snapshot.guard.blocked, 5);
  assert.deepEqual(result.snapshot.guard.blockedHosts, ["cdn.contoh.go.id"]);
  // Field lama harus tetap ada di tempatnya.
  assert.equal(result.snapshot.formatVersion, 1);
  assert.equal(result.snapshot.source.requestedUrl, "https://contoh.go.id/");
  assert.ok(result.snapshot.disclaimer.length > 0);
});

test("refuses an address that points at this computer before touching the network", async () => {
  const { calls, deps } = createFakeDeps();

  const result = await auditUrl({
    url: "http://localhost/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, STAGES.checkAddress);
  assert.deepEqual(calls, []);
});

test("rejects the whole domain when one of its addresses is private", async () => {
  const { calls, deps } = createFakeDeps({
    resolveHost: async () => {
      calls?.push?.("resolveHost");
      return ["93.184.216.34", "10.0.0.5"];
    },
  });

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked-address");
  assert.equal(result.stage, STAGES.resolveDns);
  assert.equal(calls.includes("openBrowser"), false);
});

test("stops at robots.txt and never opens the browser", async () => {
  const { calls, deps } = createFakeDeps({
    fetchRobots: async () => ({ status: 500, text: "" }),
  });

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "robots-unavailable");
  assert.equal(result.stage, STAGES.robots);
  assert.equal(calls.includes("openBrowser"), false);
});

test("waits before touching a host it visited a moment ago", async () => {
  const history = new Map();
  recordRequest({ host: "contoh.go.id", now: 1_000_000 - 1000, history });

  const { calls, deps } = createFakeDeps();

  const result = await auditUrl({ url: "https://contoh.go.id/", deps, history });

  assert.equal(result.ok, true, result.message);
  assert.ok(calls.includes(`sleep:${MIN_HOST_INTERVAL_MS - 1000}`));
});

test("treats a page that answered with an error status as a failed audit", async () => {
  const { calls, deps } = createFakeDeps({
    auditPage: async () => {
      throw new Error("HTTP 503");
    },
  });

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "status-not-ok");
  assert.equal(result.stage, STAGES.audit);
  // Browser tetap harus ditutup meski audit gagal.
  assert.ok(calls.includes("closeBrowser"));
  // Berkas tidak boleh ditulis dari audit yang gagal.
  assert.equal(calls.includes("writeSnapshot"), false);
});

test("says which part of the snapshot is missing instead of only saying it failed", async () => {
  const { deps } = createFakeDeps({
    serializePage: async () => ({
      patchedPage: null,
      readerView: null,
      blockCount: 0,
    }),
  });

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "snapshot-incomplete");
  assert.equal(result.stage, STAGES.validate);
  assert.deepEqual(result.missing, ["views.patchedPage", "views.readerView"]);
  assert.ok(result.message.includes("views.patchedPage"));
});

test("never lets a raw error escape to the caller", async () => {
  const { deps } = createFakeDeps({
    withBrowser: async () => {
      throw new Error("Executable doesn't exist");
    },
  });

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "browser-failed");
  assert.equal(result.stage, STAGES.openBrowser);
  assert.ok(result.message.includes("playwright install chromium"));
});

test("does not write any file when no output folder was asked for", async () => {
  const { calls, deps } = createFakeDeps();

  const result = await auditUrl({
    url: "https://contoh.go.id/",
    deps,
    history: new Map(),
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.files, null);
  assert.equal(calls.includes("writeSnapshot"), false);
});
