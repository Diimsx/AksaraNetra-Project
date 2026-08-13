import pg from "pg";

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
    progress: Number(row.progress),
    attempts: Number(row.attempts),
    cancelRequested: row.cancel_requested === true || row.cancel_requested === 1,
    result: row.result_json ? (typeof row.result_json === "string" ? JSON.parse(row.result_json) : row.result_json) : null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: row.started_at ? Number(row.started_at) : null,
    finishedAt: row.finished_at ? Number(row.finished_at) : null,
    expiresAt: Number(row.expires_at),
    artifactDir: row.artifact_dir,
  };
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  share_token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL CHECK(progress >= 0 AND progress <= 100),
  attempts INTEGER NOT NULL DEFAULT 0,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  result_json JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  started_at BIGINT,
  finished_at BIGINT,
  expires_at BIGINT NOT NULL,
  artifact_dir TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS jobs_ip_idx ON jobs(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS jobs_expiry_idx ON jobs(expires_at);
`;

export class JobStore {
  constructor({ databaseUrl, pool, now = () => Date.now() }) {
    this.pool = pool || new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    this.now = now;
    this._ownsPool = !pool;
  }

  async init() {
    await this.pool.query(CREATE_TABLE);
    await this.recoverInterrupted();
  }

  async close() {
    if (this._ownsPool) {
      await this.pool.end();
    }
  }

  async recoverInterrupted() {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET
        status = CASE WHEN attempts < 2 THEN 'queued' ELSE 'failed' END,
        stage = CASE WHEN attempts < 2 THEN 'Dipulihkan setelah server restart' ELSE 'Gagal setelah server restart' END,
        progress = CASE WHEN attempts < 2 THEN 0 ELSE progress END,
        error_code = CASE WHEN attempts < 2 THEN NULL ELSE 'server-restarted' END,
        error_message = CASE WHEN attempts < 2 THEN NULL ELSE 'Audit terputus dua kali karena server restart.' END,
        updated_at = $1, finished_at = CASE WHEN attempts < 2 THEN NULL::BIGINT ELSE $2 END
      WHERE status = 'running'`,
      [now, now]
    );
  }

  async createJob(job) {
    await this.pool.query(
      `INSERT INTO jobs (${JOB_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, 'queued', $6, 0, 0, FALSE, NULL, NULL, NULL, $7, $8, NULL, NULL, $9, $10)`,
      [job.id, job.tokenHash, job.shareTokenHash, job.ipHash, job.targetUrl,
        "Menunggu antrean", job.createdAt, job.createdAt, job.expiresAt, job.artifactDir]
    );
    return this.getJob(job.id);
  }

  async getJob(id) {
    const { rows } = await this.pool.query(
      `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = $1`, [id]
    );
    return mapJob(rows[0]);
  }

  async countRecentByIp(ipHash, since) {
    const { rows } = await this.pool.query(
      "SELECT COUNT(*) AS total FROM jobs WHERE ip_hash = $1 AND created_at >= $2",
      [ipHash, since]
    );
    return Number(rows[0].total);
  }

  async queuePosition(id) {
    const job = await this.getJob(id);
    if (!job || job.status !== "queued") return null;
    const { rows } = await this.pool.query(
      "SELECT COUNT(*) AS total FROM jobs WHERE status = 'queued' AND created_at <= $1",
      [job.createdAt]
    );
    return Number(rows[0].total);
  }

  async findReusable(targetUrl, now) {
    if (now === undefined) now = this.now();
    const { rows } = await this.pool.query(
      `SELECT ${JOB_COLUMNS} FROM jobs
       WHERE target_url=$1 AND status='completed' AND expires_at>$2
       ORDER BY finished_at DESC LIMIT 1`,
      [targetUrl, now]
    );
    return mapJob(rows[0]);
  }

  async claimNext() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT id FROM jobs WHERE status = 'queued' AND cancel_requested = FALSE ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      if (!rows[0]) {
        await client.query("COMMIT");
        return null;
      }
      const now = this.now();
      const { rowCount } = await client.query(
        `UPDATE jobs SET status='running', stage='Menyiapkan audit', progress=5,
          attempts=attempts+1, started_at=COALESCE(started_at, $1), updated_at=$2
         WHERE id=$3 AND status='queued'`,
        [now, now, rows[0].id]
      );
      await client.query("COMMIT");
      return rowCount ? await this.getJob(rows[0].id) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProgress(id, { stage, progress }) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET stage=$1, progress=GREATEST(progress, $2), updated_at=$3
       WHERE id=$4 AND status='running'`,
      [stage, Math.max(0, Math.min(99, progress)), now, id]
    );
  }

  async requestCancel(id) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET cancel_requested=TRUE,
        status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,
        stage=CASE WHEN status='queued' THEN 'Dibatalkan' ELSE 'Membatalkan audit' END,
        finished_at=CASE WHEN status='queued' THEN $1 ELSE finished_at END, updated_at=$2
       WHERE id=$3 AND status IN ('queued','running')`,
      [now, now, id]
    );
    return this.getJob(id);
  }

  async complete(id, result) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET status='completed', stage='Audit selesai', progress=100,
        result_json=$1, error_code=NULL, error_message=NULL, finished_at=$2, updated_at=$3
       WHERE id=$4 AND status='running'`,
      [JSON.stringify(result), now, now, id]
    );
  }

  async completeQueued(id, result) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET status='completed', stage='Menggunakan hasil tersimpan', progress=100,
        result_json=$1, started_at=$2, finished_at=$3, updated_at=$4
       WHERE id=$5 AND status='queued'`,
      [JSON.stringify(result), now, now, now, id]
    );
  }

  async fail(id, { code, message }) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET status='failed', stage='Audit gagal', error_code=$1, error_message=$2,
        finished_at=$3, updated_at=$4 WHERE id=$5 AND status='running'`,
      [code, message, now, now, id]
    );
  }

  async cancelRunning(id) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET status='cancelled', stage='Dibatalkan', error_code=NULL,
        error_message=NULL, finished_at=$1, updated_at=$2 WHERE id=$3 AND status='running'`,
      [now, now, id]
    );
  }

  async retry(id, { code, message }) {
    const now = this.now();
    await this.pool.query(
      `UPDATE jobs SET status='queued', stage='Menunggu percobaan ulang', progress=0,
        error_code=$1, error_message=$2, updated_at=$3
       WHERE id=$4 AND status='running' AND attempts < 2`,
      [code, message, now, id]
    );
  }

  async expired(now) {
    if (now === undefined) now = this.now();
    const { rows } = await this.pool.query(
      "SELECT id, artifact_dir FROM jobs WHERE expires_at <= $1", [now]
    );
    return rows;
  }

  async deleteExpired(now) {
    if (now === undefined) now = this.now();
    const rows = await this.expired(now);
    await this.pool.query("DELETE FROM jobs WHERE expires_at <= $1", [now]);
    return rows;
  }
}
