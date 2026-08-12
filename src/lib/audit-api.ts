export type JobStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AuditJob {
  jobId: string;
  url: string;
  status: JobStatus;
  stage: string;
  progress: number;
  queuePosition: number | null;
  attempts: number;
  canCancel: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string;
  error: { code: string; message: string } | null;
}

export interface Snapshot {
  engineVersion: string;
  capturedAt: string;
  disclaimer: string;
  source: {
    requestedUrl: string;
    finalUrl: string;
    title: string;
    status: number;
    siteLabel?: string | null;
  };
  summary: {
    beforeTotal: number;
    afterTotal: number;
    reduction: number;
    reductionPercent: number;
    strictImprovement: boolean;
    noRegression: boolean;
  };
  rules: Record<string, { before: number; after: number; reduction?: number }>;
  counts: {
    fixed: number;
    review: number;
    skipped: number;
    rolledBack: number;
    verifiedOverrides: number;
  };
  warnings: {
    rolledBack: boolean;
    wcagRegressionClean: boolean;
    worsenedRules: Array<{
      ruleId: string;
      before: number;
      after: number;
      delta: number;
    }>;
    duplicateLabels: unknown[];
    staleOverrides: string[];
    rolledBackRecords: unknown[];
  };
}

export interface AuditResult {
  job: AuditJob;
  result: { snapshot: Snapshot; artifacts: Record<string, string> };
  links: {
    reader: string;
    patched: string;
    reportPdf: string;
    screenshot: string;
  };
}

const configuredBase =
  process.env.NEXT_PUBLIC_AUDIT_API_URL || "http://localhost:8787";
export const AUDIT_API_BASE = configuredBase.replace(/\/$/, "");

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUDIT_API_BASE}${path}`, {
    ...init,
    headers: { accept: "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      body?.message || body?.error || `Backend merespons ${response.status}`,
    );
    Object.assign(error, { status: response.status, body });
    throw error;
  }
  return body as T;
}

export async function checkAuditCache(url: string) {
  return json<{
    available: boolean;
    capturedAt: string | null;
    expiresAt: string | null;
  }>(`/audits/cache?url=${encodeURIComponent(url)}`);
}

export async function createAudit(url: string, reuseExisting = false) {
  return json<{
    jobId: string;
    accessToken: string;
    status: JobStatus;
    expiresAt: string;
  }>("/audits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, reuseExisting }),
  });
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
export const getAudit = (jobId: string, token: string) =>
  json<{ job: AuditJob }>(`/audits/${encodeURIComponent(jobId)}`, {
    headers: auth(token),
  });
export const getAuditResult = (jobId: string, token: string) =>
  json<AuditResult>(`/audits/${encodeURIComponent(jobId)}/result`, {
    headers: auth(token),
  });
export const cancelAudit = (jobId: string, token: string) =>
  json<{ job: AuditJob }>(`/audits/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: auth(token),
  });

const tokenKey = (jobId: string) => `aksaranetra:job:${jobId}`;
export function saveJobToken(jobId: string, token: string) {
  window.localStorage.setItem(tokenKey(jobId), token);
}
export function readJobToken(jobId: string) {
  return window.localStorage.getItem(tokenKey(jobId));
}
export function removeJobToken(jobId: string) {
  window.localStorage.removeItem(tokenKey(jobId));
}
export function artifactUrl(path: string) {
  return path.startsWith("http") ? path : `${AUDIT_API_BASE}${path}`;
}
