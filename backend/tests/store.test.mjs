import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { JobStore } from "../src/store.mjs";

function create(store, root, id, now, expiresAt = now + 10_000) {
  return store.createJob({
    id,
    tokenHash: "a".repeat(64),
    shareTokenHash: "b".repeat(64),
    ipHash: "c".repeat(64),
    targetUrl: "https://example.com/",
    createdAt: now,
    expiresAt,
    artifactDir: path.join(root, id),
  });
}

test("persists queue state and recovers interrupted jobs once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aksara-store-"));
  const db = path.join(root, "jobs.sqlite");
  let now = 1_000;
  let store = new JobStore({ databasePath: db, now: () => now });
  create(store, root, "job-1", now);
  assert.equal(store.claimNext().attempts, 1);
  store.close();

  now += 100;
  store = new JobStore({ databasePath: db, now: () => now });
  assert.equal(store.getJob("job-1").status, "queued");
  assert.equal(store.claimNext().attempts, 2);
  store.close();

  now += 100;
  store = new JobStore({ databasePath: db, now: () => now });
  assert.equal(store.getJob("job-1").status, "failed");
  assert.equal(store.getJob("job-1").errorCode, "server-restarted");
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("returns expired artifact folders before deleting rows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aksara-expiry-"));
  const store = new JobStore({ databasePath: path.join(root, "jobs.sqlite"), now: () => 5_000 });
  create(store, root, "expired", 1_000, 2_000);
  const rows = store.deleteExpired(5_000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "expired");
  assert.equal(store.getJob("expired"), null);
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});
