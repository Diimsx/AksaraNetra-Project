import fs from "node:fs";
import http from "node:http";

import { pathToFileURL } from "node:url";
import { createApp } from "./app.mjs";
import { createAuditor } from "./auditor.mjs";
import { loadConfig } from "./config.mjs";
import { JobStore } from "./store.mjs";
import { AuditWorker } from "./worker.mjs";

export function createService(overrides = {}) {
  const config = loadConfig(overrides.config);
  fs.mkdirSync(config.artifactsDir, { recursive: true });
  const store =
    overrides.store || new JobStore({ databasePath: config.databasePath });
  const worker =
    overrides.worker ||
    new AuditWorker({
      store,
      auditor: overrides.auditor || createAuditor(),
      timeoutMs: config.timeoutMs,
      concurrency: config.concurrency,
    });
  const server = http.createServer(createApp({ config, store, worker }));

  const cleanup = () => {
    for (const job of store.deleteExpired()) {
      fs.rmSync(job.artifact_dir, { recursive: true, force: true });
    }
  };
  cleanup();
  const cleanupTimer = setInterval(cleanup, config.cleanupIntervalMs);
  cleanupTimer.unref?.();

  const start = () =>
    new Promise((resolve) => {
      server.listen(config.port, config.host, () => {
        worker.start();
        resolve(server.address());
      });
    });
  const stop = () =>
    new Promise((resolve) => {
      clearInterval(cleanupTimer);
      server.close(async () => {
        await worker.stop();
        store.close?.();
        resolve();
      });
    });

  return { config, store, worker, server, start, stop, cleanup };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createService();
  const address = await service.start();
  console.log(
    "AksaraNetra backend listening",
    service.config.host,
    address.port,
  );
  const shutdown = async () => {
    await service.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
