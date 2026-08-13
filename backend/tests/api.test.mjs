import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import pg from "pg";

import { createApp } from "../src/app.mjs";
import { loadConfig } from "../src/config.mjs";
import { JobStore } from "../src/store.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Skipping api tests: DATABASE_URL not set");
  process.exit(0);
}

async function setup({ rateLimit = 10 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aksara-api-"));
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  const store = new JobStore({ pool });
  await store.init();
  // Clean up ALL leftover jobs from previous test runs to prevent interference
  await pool.query("DELETE FROM jobs");
  const config = loadConfig({
    dataDir: root,
    databaseUrl: DATABASE_URL,
    artifactsDir: path.join(root, "artifacts"),
    secret: "test-secret-that-is-long-enough-123456",
    frontendOrigins: ["https://frontend.test"],
    rateLimit,
    rateWindowMs: 60_000,
    retentionMs: 60_000,
  });
  const worker = {
    kicks: 0,
    kick() { this.kicks += 1; },
    async cancel(id) { return store.requestCancel(id); },
  };
  const server = http.createServer(createApp({ config, store, worker }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    // Clean up test jobs from this run
    await pool.query("DELETE FROM jobs WHERE artifact_dir LIKE $1", [root + "%"]);
    await pool.end();
    fs.rmSync(root, { recursive: true, force: true });
  };
  return { root, config, store, worker, base, close, pool };
}

async function createJob(item, url = "https://example.com/", extra = {}) {
  const response = await fetch(`${item.base}/audits`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://frontend.test" },
    body: JSON.stringify({ url, ...extra }),
  });
  return { response, body: await response.json() };
}

test("creates an anonymous job but hides it without its token", async () => {
  const item = await setup();
  const created = await createJob(item);
  assert.equal(created.response.status, 202);
  assert.match(created.body.jobId, /^aud_/);
  assert.ok(created.body.accessToken.length > 30);
  assert.equal(item.worker.kicks, 1);

  const hidden = await fetch(`${item.base}/audits/${created.body.jobId}`);
  assert.equal(hidden.status, 404);
  const visible = await fetch(`${item.base}/audits/${created.body.jobId}`, {
    headers: { authorization: `Bearer ${created.body.accessToken}` },
  });
  assert.equal(visible.status, 200);
  assert.equal((await visible.json()).job.status, "queued");
  await item.close();
});

test("returns expiring reader and PDF links only after completion", async () => {
  const item = await setup();
  const created = await createJob(item);
  const job = await item.store.claimNext();
  fs.mkdirSync(job.artifactDir, { recursive: true });
  fs.writeFileSync(path.join(job.artifactDir, "reader.html"), "<!doctype html><title>Reader</title>");
  fs.writeFileSync(path.join(job.artifactDir, "patched.html"), "<!doctype html><title>Patched</title>");
  fs.writeFileSync(path.join(job.artifactDir, "report.pdf"), "%PDF-test");
  fs.writeFileSync(path.join(job.artifactDir, "after.png"), "png");
  await item.store.complete(job.id, { snapshot: { summary: { beforeTotal: 2, afterTotal: 0 } } });

  const result = await fetch(`${item.base}/audits/${job.id}/result`, {
    headers: { authorization: `Bearer ${created.body.accessToken}` },
  });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.match(data.links.reader, /token=/);
  const reader = await fetch(`${item.base}${data.links.reader}`);
  assert.equal(reader.status, 200);
  assert.match(await reader.text(), /Reader/);
  await item.close();
});

test("lets the user explicitly reuse a stored result", async () => {
  const item = await setup();
  const first = await createJob(item);
  const original = await item.store.claimNext();
  fs.mkdirSync(original.artifactDir, { recursive: true });
  fs.writeFileSync(path.join(original.artifactDir, "reader.html"), "stored reader");
  await item.store.complete(original.id, { snapshot: { cached: true } });

  const lookup = await fetch(`${item.base}/audits/cache?url=${encodeURIComponent("https://example.com/")}`);
  assert.equal((await lookup.json()).available, true);

  const reused = await createJob(item, "https://example.com/", { reuseExisting: true });
  assert.equal(reused.response.status, 200);
  assert.equal(reused.body.status, "completed");
  assert.equal(item.worker.kicks, 1);
  const reusedJob = await item.store.getJob(reused.body.jobId);
  assert.equal(reusedJob.result.snapshot.cached, true);
  await item.close();
});

test("enforces per-IP rate limit and supports queued cancellation", async () => {
  const item = await setup({ rateLimit: 1 });
  const first = await createJob(item);
  const second = await createJob(item, "https://example.org/");
  assert.equal(second.response.status, 429);

  const cancelled = await fetch(`${item.base}/audits/${first.body.jobId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${first.body.accessToken}` },
  });
  assert.equal(cancelled.status, 202);
  assert.equal((await cancelled.json()).job.status, "cancelled");
  await item.close();
});

test("rejects untrusted browser origins", async () => {
  const item = await setup();
  const response = await fetch(`${item.base}/health`, { headers: { origin: "https://evil.test" } });
  assert.equal(response.status, 403);
  await item.close();
});
