import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { JobStore } from "../src/store.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Skipping store tests: DATABASE_URL not set");
  process.exit(0);
}

async function createStore(now = () => Date.now()) {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  const store = new JobStore({ pool, now });
  await store.init();
  // Clean up any leftover test data
  await pool.query("DELETE FROM jobs WHERE id LIKE 'test-%'");
  return { store, pool };
}

async function createTestJob(store, root, id, now, expiresAt = now + 10_000) {
  return store.createJob({
    id,
    tokenHash: "a".repeat(64),
    shareTokenHash: "b".repeat(64),
    ipHash: "c".repeat(64),
    targetUrl: "https://example.com/",
    createdAt: now,
    expiresAt,
    artifactDir: root + "/" + id,
  });
}

test("persists queue state and recovers interrupted jobs once", async () => {
  let now = 1_000;
  const { store, pool } = await createStore(() => now);
  const id = "test-recover-" + Date.now();
  await createTestJob(store, "/tmp", id, now);
  const claimed = await store.claimNext();
  assert.equal(claimed.attempts, 1);

  // Simulate restart: recover interrupted
  now += 100;
  await store.recoverInterrupted();
  const recovered = await store.getJob(id);
  assert.equal(recovered.status, "queued");

  const claimed2 = await store.claimNext();
  assert.equal(claimed2.attempts, 2);

  // Second restart: should fail since attempts >= 2
  now += 100;
  await store.recoverInterrupted();
  const failed = await store.getJob(id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorCode, "server-restarted");

  // Cleanup
  await pool.query("DELETE FROM jobs WHERE id = $1", [id]);
  await pool.end();
});

test("returns expired artifact folders before deleting rows", async () => {
  const { store, pool } = await createStore(() => 5_000);
  const id = "test-expiry-" + Date.now();
  await createTestJob(store, "/tmp", id, 1_000, 2_000);
  const rows = await store.deleteExpired(5_000);
  assert.equal(rows.length >= 1, true);
  assert.ok(rows.some(r => r.id === id));
  assert.equal(await store.getJob(id), null);
  await pool.end();
});
