import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

import { JobStore } from "../src/store.mjs";
import { AuditWorker } from "../src/worker.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Skipping worker tests: DATABASE_URL not set");
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(25);
  }
  throw new Error("condition timed out");
}

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aksara-worker-"));
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  const store = new JobStore({ pool });
  await store.init();
  // Clean up leftover jobs from previous test runs
  await pool.query("DELETE FROM jobs");
  const add = async (id) => store.createJob({
    id,
    tokenHash: "a".repeat(64), shareTokenHash: "b".repeat(64), ipHash: "c".repeat(64),
    targetUrl: "https://example.com/", createdAt: Date.now(), expiresAt: Date.now() + 60_000,
    artifactDir: path.join(root, id),
  });
  return { root, store, add, pool };
}

async function cleanup(item, worker) {
  await worker.stop();
  // Clean up test data
  await item.pool.query("DELETE FROM jobs WHERE artifact_dir LIKE $1", [item.root + "%"]);
  await item.pool.end();
  fs.rmSync(item.root, { recursive: true, force: true });
}

test("runs only one audit at a time", async () => {
  const item = await fixture();
  await item.add("wt-one-" + Date.now()); await item.add("wt-two-" + Date.now());
  let active = 0; let maximum = 0;
  const worker = new AuditWorker({ store: item.store, timeoutMs: 5000, auditor: async ({ onProgress }) => {
    active += 1; maximum = Math.max(maximum, active);
    await onProgress({ progress: 50, stage: "Sedang audit" });
    await sleep(30); active -= 1;
    return { snapshot: { ok: true } };
  }});
  worker.start();
  // Wait for all jobs to complete
  await waitFor(async () => {
    const jobs = await item.pool.query(
      "SELECT COUNT(*) as cnt FROM jobs WHERE artifact_dir LIKE $1 AND status = 'completed'",
      [item.root + "%"]
    );
    return Number(jobs.rows[0].cnt) >= 2;
  }, 5000);
  assert.equal(maximum, 1);
  await cleanup(item, worker);
});

test("retries one transient failure and then succeeds", async () => {
  const item = await fixture();
  const id = "wt-retry-" + Date.now();
  await item.add(id);
  let calls = 0;
  const worker = new AuditWorker({ store: item.store, timeoutMs: 5000, auditor: async () => {
    calls += 1;
    if (calls === 1) { const error = new Error("browser closed"); error.code = "browser-failed"; throw error; }
    return { snapshot: { ok: true } };
  }});
  worker.start();
  await waitFor(async () => (await item.store.getJob(id))?.status === "completed");
  assert.equal(calls, 2);
  assert.equal((await item.store.getJob(id)).attempts, 2);
  await cleanup(item, worker);
});

test("cancels a running audit and removes partial artifacts", async () => {
  const item = await fixture();
  const id = "wt-cancel-" + Date.now();
  await item.add(id);
  fs.mkdirSync(path.join(item.root, id), { recursive: true });
  fs.writeFileSync(path.join(item.root, id, "partial.txt"), "partial");
  const worker = new AuditWorker({ store: item.store, timeoutMs: 5000, auditor: async ({ signal }) => {
    await new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  }});
  worker.start();
  await waitFor(async () => (await item.store.getJob(id))?.status === "running");
  await worker.cancel(id);
  await waitFor(async () => (await item.store.getJob(id))?.status === "cancelled");
  assert.equal(fs.existsSync(path.join(item.root, id)), false);
  await cleanup(item, worker);
});
