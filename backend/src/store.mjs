import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const JOB_COLUMNS = `id, token_hash, share_token_hash, ip_hash, target_url, status,
stage, progress, attempts, cancel_requested, result_json, error_code, error_message,
created_at, updated_at, started_at, finished_at, expires_at, artifact_dir`;

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    tokenHash: row.token_hash,
    shareTokenHash: row.share_token_hash,
    ipHash: row.ip_hash,
    targetUrl: row.target_url,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    attempts: row.attempts,
    cancelRequested: row.cancel_requested === 1,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    expiresAt: row.expires_at,
    artifactDir: row.artifact_dir,
  };
}

export class JobStore {
  constructor({ databasePath, now = () => Date.now() }) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.now = now;
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      share_token_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      target_url TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
      attempts INTEGER NOT NULL DEFAULT 0,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      result_json TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      expires_at INTEGER NOT NULL,
      artifact_dir TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(status, created_at);
    CREATE INDEX IF NOT EXISTS jobs_ip_idx ON jobs(ip_hash, created_at);
    CREATE INDEX IF NOT EXISTS jobs_expiry_idx ON jobs(expires_at);`);
    this.recoverInterrupted();
  }

  close() { this.db.close(); }

  recoverInterrupted() {
    const now = this.now();
    const runningJobs = this.db.prepare("SELECT id, artifact_dir, attempts, progress FROM jobs WHERE status = 'running'").all();

    for (const job of runningJobs) {
      const snapshotPath = path.join(job.artifact_dir, "snapshot.json");
      const hasCheckpoint = fs.existsSync(snapshotPath);
      const shouldRetry = job.attempts < 2;

      if (hasCheckpoint) {
        // Jika snapshot sudah ada, job sudah 90% selesai. Pulihkan ke antrean dengan progress 90%
        this.db.prepare(`UPDATE jobs SET status = 'queued',
          stage = 'Melanjutkan finalisasi dari checkpoint tersimpan',
          progress = 90,
          error_code = NULL,
          error_message = NULL,
          updated_at = ?, finished_at = NULL
          WHERE id = ?`).run(now, job.id);
      } else if (shouldRetry) {
        this.db.prepare(`UPDATE jobs SET status = 'queued',
          stage = 'Dipulihkan setelah server restart',
          progress = 0,
          error_code = NULL,
          error_message = NULL,
          updated_at = ?, finished_at = NULL
          WHERE id = ?`).run(now, job.id);
      } else {
        this.db.prepare(`UPDATE jobs SET status = 'failed',
          stage = 'Gagal setelah server restart',
          progress = progress,
          error_code = 'server-restarted',
          error_message = 'Audit terputus dua kali karena server restart.',
          updated_at = ?, finished_at = ?
          WHERE id = ?`).run(now, now, job.id);
      }
    }
  }

  createJob(job) {
    this.db.prepare(`INSERT INTO jobs (${JOB_COLUMNS}) VALUES (?, ?, ?, ?, ?, 'queued', ?, 0, 0, 0, NULL, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`)
      .run(job.id, job.tokenHash, job.shareTokenHash, job.ipHash, job.targetUrl,
        "Menunggu antrean", job.createdAt, job.createdAt, job.expiresAt, job.artifactDir);
    return this.getJob(job.id);
  }

  getJob(id) {
    return mapJob(this.db.prepare(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`).get(id));
  }

  countRecentByIp(ipHash, since) {
    return this.db.prepare("SELECT COUNT(*) AS total FROM jobs WHERE ip_hash = ? AND created_at >= ?")
      .get(ipHash, since).total;
  }

  queuePosition(id) {
    const job = this.getJob(id);
    if (!job || job.status !== "queued") return null;
    return this.db.prepare("SELECT COUNT(*) AS total FROM jobs WHERE status = 'queued' AND created_at <= ?")
      .get(job.createdAt).total;
  }

  findReusable(targetUrl, now = this.now()) {
    return mapJob(this.db.prepare(`SELECT ${JOB_COLUMNS} FROM jobs
      WHERE target_url=? AND status='completed' AND expires_at>? ORDER BY finished_at DESC LIMIT 1`)
      .get(targetUrl, now));
  }

  claimNext() {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT id FROM jobs WHERE status = 'queued' AND cancel_requested = 0 ORDER BY created_at LIMIT 1").get();
      if (!row) { this.db.exec("COMMIT"); return null; }
      const now = this.now();
      const changed = this.db.prepare(`UPDATE jobs SET status='running', stage='Menyiapkan audit', progress=5,
        attempts=attempts+1, started_at=COALESCE(started_at, ?), updated_at=? WHERE id=? AND status='queued'`)
        .run(now, now, row.id);
      this.db.exec("COMMIT");
      return changed.changes ? this.getJob(row.id) : null;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  updateProgress(id, { stage, progress }) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET stage=?, progress=MAX(progress, ?), updated_at=?
      WHERE id=? AND status='running'`).run(stage, Math.max(0, Math.min(99, progress)), now, id);
  }

  requestCancel(id) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET cancel_requested=1,
      status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,
      stage=CASE WHEN status='queued' THEN 'Dibatalkan' ELSE 'Membatalkan audit' END,
      finished_at=CASE WHEN status='queued' THEN ? ELSE finished_at END, updated_at=?
      WHERE id=? AND status IN ('queued','running')`).run(now, now, id);
    return this.getJob(id);
  }

  complete(id, result) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET status='completed', stage='Audit selesai', progress=100,
      result_json=?, error_code=NULL, error_message=NULL, finished_at=?, updated_at=? WHERE id=? AND status='running'`)
      .run(JSON.stringify(result), now, now, id);
  }

  completeQueued(id, result) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET status='completed', stage='Menggunakan hasil tersimpan', progress=100,
      result_json=?, started_at=?, finished_at=?, updated_at=? WHERE id=? AND status='queued'`)
      .run(JSON.stringify(result), now, now, now, id);
  }

  fail(id, { code, message }) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET status='failed', stage='Audit gagal', error_code=?, error_message=?,
      finished_at=?, updated_at=? WHERE id=? AND status='running'`).run(code, message, now, now, id);
  }

  cancelRunning(id) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET status='cancelled', stage='Dibatalkan', error_code=NULL,
      error_message=NULL, finished_at=?, updated_at=? WHERE id=? AND status='running'`).run(now, now, id);
  }

  retry(id, { code, message }) {
    const now = this.now();
    this.db.prepare(`UPDATE jobs SET status='queued', stage='Menunggu percobaan ulang', progress=0,
      error_code=?, error_message=?, updated_at=? WHERE id=? AND status='running' AND attempts < 2`)
      .run(code, message, now, id);
  }

  expired(now = this.now()) {
    return this.db.prepare("SELECT id, artifact_dir FROM jobs WHERE expires_at <= ?").all(now);
  }

  deleteExpired(now = this.now()) {
    const rows = this.expired(now);
    this.db.prepare("DELETE FROM jobs WHERE expires_at <= ?").run(now);
    return rows;
  }
}
