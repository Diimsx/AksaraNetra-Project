import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { JobStore } from "../src/store.mjs";
import { AuditWorker } from "../src/worker.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, timeout = 1500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await sleep(10);
  }
  throw new Error("condition timed out");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aksara-worker-"));
  const store = new JobStore({ databasePath: path.join(root, "jobs.sqlite") });
  const add = (id) => store.createJob({
    id,
    tokenHash: "a".repeat(64), shareTokenHash: "b".repeat(64), ipHash: "c".repeat(64),
    targetUrl: "https://example.com/", createdAt: Date.now(), expiresAt: Date.now() + 60_000,
    artifactDir: path.join(root, id),
  });
  return { root, store, add };
}

async function cleanup(item, worker) {
  await worker.stop();
  item.store.close();
  fs.rmSync(item.root, { recursive: true, force: true });
}

test("runs only one audit at a time", async () => {
  const item = fixture();
  item.add("one"); item.add("two");
  let active = 0; let maximum = 0;
  const worker = new AuditWorker({ store: item.store, timeoutMs: 1000, auditor: async ({ onProgress }) => {
    active += 1; maximum = Math.max(maximum, active);
    await onProgress({ progress: 50, stage: "Sedang audit" });
    await sleep(30); active -= 1;
    return { snapshot: { ok: true } };
  }});
  worker.start();
  await waitFor(() => item.store.getJob("two").status === "completed");
  assert.equal(maximum, 1);
  assert.equal(item.store.getJob("one").progress, 100);
  await cleanup(item, worker);
});

test("retries one transient failure and then succeeds", async () => {
  const item = fixture(); item.add("retry");
  let calls = 0;
  const worker = new AuditWorker({ store: item.store, timeoutMs: 1000, auditor: async () => {
    calls += 1;
    if (calls === 1) { const error = new Error("browser closed"); error.code = "browser-failed"; throw error; }
    return { snapshot: { ok: true } };
  }});
  worker.start();
  await waitFor(() => item.store.getJob("retry").status === "completed");
  assert.equal(calls, 2);
  assert.equal(item.store.getJob("retry").attempts, 2);
  await cleanup(item, worker);
});

test("cancels a running audit and removes partial artifacts", async () => {
  const item = fixture(); item.add("cancel");
  fs.mkdirSync(path.join(item.root, "cancel"), { recursive: true });
  fs.writeFileSync(path.join(item.root, "cancel", "partial.txt"), "partial");
  const worker = new AuditWorker({ store: item.store, timeoutMs: 1000, auditor: async ({ signal }) => {
    await new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  }});
  worker.start();
  await waitFor(() => item.store.getJob("cancel").status === "running");
  worker.cancel("cancel");
  await waitFor(() => item.store.getJob("cancel").status === "cancelled");
  assert.equal(fs.existsSync(path.join(item.root, "cancel")), false);
  await cleanup(item, worker);
});
