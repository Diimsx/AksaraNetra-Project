import fs from "node:fs";

const TRANSIENT_CODES = new Set([
  "dns-lookup-failed",
  "robots-fetch-failed",
  "browser-failed",
  "audit-failed",
]);

export class AuditWorker {
  constructor({ store, auditor, timeoutMs = 180_000, concurrency = 1 }) {
    this.store = store;
    this.auditor = auditor;
    this.timeoutMs = timeoutMs;
    this.concurrency = concurrency;
    this.active = new Map();
    this.runs = new Set();
    this.scheduled = false;
    this.stopped = true;
  }

  start() {
    this.stopped = false;
    this.kick();
  }

  async stop() {
    this.stopped = true;
    for (const controller of this.active.values()) controller.abort("server-stopping");
    await Promise.allSettled([...this.runs]);
  }

  kick() {
    if (this.stopped || this.scheduled) return;
    this.scheduled = true;
    setImmediate(() => {
      this.scheduled = false;
      this.drain().catch((error) => console.error("worker drain failed", error));
    });
  }

  async drain() {
    while (!this.stopped && this.active.size < this.concurrency) {
      const job = await this.store.claimNext();
      if (!job) return;
      const run = this.run(job);
      this.runs.add(run);
      void run.finally(() => this.runs.delete(run));
    }
  }

  async run(job) {
    const controller = new AbortController();
    this.active.set(job.id, controller);
    const timeout = setTimeout(() => controller.abort("timeout"), this.timeoutMs);
    timeout.unref?.();

    try {
      const result = await this.auditor({
        job,
        signal: controller.signal,
        onProgress: (update) => this.store.updateProgress(job.id, update),
      });
      if (controller.signal.aborted || (await this.store.getJob(job.id))?.cancelRequested) {
        await this.store.cancelRunning(job.id);
        fs.rmSync(job.artifactDir, { recursive: true, force: true });
      } else {
        await this.store.complete(job.id, result);
      }
    } catch (error) {
      const current = await this.store.getJob(job.id);
      if (controller.signal.reason === "server-stopping") return;
      if (controller.signal.aborted || current?.cancelRequested) {
        const timedOut = controller.signal.reason === "timeout";
        if (timedOut) {
          await this.store.fail(job.id, {
            code: "audit-timeout",
            message: `Audit melewati batas ${Math.round(this.timeoutMs / 1000)} detik.`,
          });
        } else {
          await this.store.cancelRunning(job.id);
        }
        fs.rmSync(job.artifactDir, { recursive: true, force: true });
      } else {
        const code = error.code || "audit-failed";
        const message = error.message || "Audit gagal.";
        if (TRANSIENT_CODES.has(code) && current?.attempts < 2) {
          await this.store.retry(job.id, { code, message });
        } else {
          await this.store.fail(job.id, { code, message });
          fs.rmSync(job.artifactDir, { recursive: true, force: true });
        }
      }
    } finally {
      clearTimeout(timeout);
      this.active.delete(job.id);
      this.kick();
    }
  }

  async cancel(id) {
    const job = await this.store.requestCancel(id);
    this.active.get(id)?.abort("cancelled-by-user");
    return job;
  }
}
