import path from "node:path";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function integer(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} harus berupa bilangan bulat ${min}–${max}.`);
  }
  return value;
}

function requiredSecret() {
  const value = process.env.BACKEND_SECRET || "";
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    throw new Error("BACKEND_SECRET minimal 32 karakter di production.");
  }
  return value || "aksaranetra-development-secret-change-me";
}

export function loadConfig(overrides = {}) {
  const environment = process.env.NODE_ENV || "development";
  const dataDir = path.resolve(process.env.BACKEND_DATA_DIR || "backend/data");
  const origins = (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    environment,
    host: process.env.HOST || "127.0.0.1",
    port: integer("PORT", 8787, { max: 65535 }),
    dataDir,
    databaseUrl: process.env.DATABASE_URL || "",
    artifactsDir: path.join(dataDir, "artifacts"),
    frontendOrigins: origins,
    trustProxy: process.env.TRUST_PROXY === "1",
    secret: requiredSecret(),
    concurrency: 1,
    timeoutMs: integer("AUDIT_TIMEOUT_MS", 180_000, { min: 30_000, max: 600_000 }),
    retentionMs: integer("RESULT_RETENTION_MS", 7 * DAY, { min: HOUR, max: 30 * DAY }),
    rateWindowMs: HOUR,
    rateLimit: integer(
      "AUDIT_RATE_LIMIT",
      environment === "production" ? 5 : 10,
      { min: 1, max: 100 },
    ),
    maxBodyBytes: integer("MAX_BODY_BYTES", 8192, { min: 1024, max: 65_536 }),
    cleanupIntervalMs: integer("CLEANUP_INTERVAL_MS", HOUR, { min: 60_000, max: DAY }),
    ...overrides,
  };
}
