import type { AuditJob, JobStatus } from "./audit-api";

export const RECENT_AUDITS_KEY = "aksaranetra:recent-audits:v1";
export const RECENT_AUDIT_VERSION = 1 as const;

export interface RecentAudit {
  version: typeof RECENT_AUDIT_VERSION;
  jobId: string;
  sourceUrl: string;
  status: JobStatus;
  stage: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  title?: string;
  errorCode?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_STATUSES = new Set<JobStatus>([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

function browserStorage(): StorageLike {
  if (typeof window === "undefined")
    throw new Error("Riwayat audit hanya tersedia di browser.");
  return window.localStorage;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

function isPublicHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isRecentAudit(value: unknown): value is RecentAudit {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentAudit>;
  return (
    item.version === RECENT_AUDIT_VERSION &&
    typeof item.jobId === "string" &&
    /^aud_[A-Za-z0-9_-]+$/.test(item.jobId) &&
    isPublicHttpUrl(item.sourceUrl) &&
    typeof item.status === "string" &&
    VALID_STATUSES.has(item.status as JobStatus) &&
    typeof item.stage === "string" &&
    item.stage.length <= 160 &&
    typeof item.progress === "number" &&
    Number.isInteger(item.progress) &&
    item.progress >= 0 &&
    item.progress <= 100 &&
    isIsoDate(item.createdAt) &&
    isIsoDate(item.updatedAt) &&
    isIsoDate(item.expiresAt) &&
    (item.title === undefined ||
      (typeof item.title === "string" && item.title.length <= 240)) &&
    (item.errorCode === undefined ||
      (typeof item.errorCode === "string" && item.errorCode.length <= 80))
  );
}

const sortNewest = (items: RecentAudit[]) =>
  [...items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

export function readRecentAudits(
  storage: StorageLike = browserStorage(),
  now = Date.now(),
): RecentAudit[] {
  const raw = storage.getItem(RECENT_AUDITS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; items?: unknown };
    if (
      parsed.version !== RECENT_AUDIT_VERSION ||
      !Array.isArray(parsed.items)
    ) {
      storage.removeItem(RECENT_AUDITS_KEY);
      return [];
    }
    const valid = parsed.items.filter(
      (item): item is RecentAudit =>
        isRecentAudit(item) && Date.parse(item.expiresAt) > now,
    );
    if (valid.length !== parsed.items.length)
      writeRecentAudits(valid, storage, now);
    return sortNewest(valid);
  } catch {
    storage.removeItem(RECENT_AUDITS_KEY);
    return [];
  }
}

export function writeRecentAudits(
  items: RecentAudit[],
  storage: StorageLike = browserStorage(),
  now = Date.now(),
): RecentAudit[] {
  const unique = new Map<string, RecentAudit>();
  for (const item of items) {
    if (!isRecentAudit(item) || Date.parse(item.expiresAt) <= now) continue;
    const existing = unique.get(item.jobId);
    if (
      !existing ||
      Date.parse(item.updatedAt) >= Date.parse(existing.updatedAt)
    )
      unique.set(item.jobId, item);
  }
  const next = sortNewest([...unique.values()]);
  if (next.length === 0) storage.removeItem(RECENT_AUDITS_KEY);
  else
    storage.setItem(
      RECENT_AUDITS_KEY,
      JSON.stringify({ version: RECENT_AUDIT_VERSION, items: next }),
    );
  return next;
}

export function saveRecentAudit(
  item: RecentAudit,
  storage: StorageLike = browserStorage(),
  now = Date.now(),
): RecentAudit[] {
  return writeRecentAudits(
    [
      item,
      ...readRecentAudits(storage, now).filter(
        (entry) => entry.jobId !== item.jobId,
      ),
    ],
    storage,
    now,
  );
}

export function recentAuditFromJob(
  job: AuditJob,
  previous?: RecentAudit,
): RecentAudit {
  return {
    version: RECENT_AUDIT_VERSION,
    jobId: job.jobId,
    sourceUrl: job.url,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.finishedAt || job.startedAt || job.createdAt,
    expiresAt: job.expiresAt,
    title: previous?.title,
    errorCode: job.error?.code,
  };
}

export function removeRecentAudit(
  jobId: string,
  storage: StorageLike = browserStorage(),
  now = Date.now(),
): RecentAudit[] {
  return writeRecentAudits(
    readRecentAudits(storage, now).filter((item) => item.jobId !== jobId),
    storage,
    now,
  );
}

export function findRecentAudit(
  jobId: string,
  storage: StorageLike = browserStorage(),
  now = Date.now(),
) {
  return readRecentAudits(storage, now).find((item) => item.jobId === jobId);
}
