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

export type PublicErrorCode =
  | "INVALID_URL"
  | "TARGET_NOT_PUBLIC"
  | "TARGET_UNREACHABLE"
  | "TARGET_TIMEOUT"
  | "TARGET_BLOCKED_BY_ROBOTS"
  | "BROWSER_NOT_INSTALLED"
  | "AUDIT_RUNTIME_UNAVAILABLE"
  | "RATE_LIMITED"
  | "RESULT_EXPIRED"
  | "AUDIT_NOT_FOUND"
  | "AUDIT_CANCELLED"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

interface PublicErrorCopy {
  title: string;
  message: string;
  actionLabel: string;
}

const ERROR_COPY: Record<PublicErrorCode, PublicErrorCopy> = {
  INVALID_URL: {
    title: "Alamat belum bisa diproses",
    message: "Periksa kembali URL dan pastikan alamat diawali http atau https.",
    actionLabel: "Periksa URL",
  },
  TARGET_NOT_PUBLIC: {
    title: "Halaman tidak dapat diaudit",
    message:
      "AksaraNetra hanya dapat membuka halaman web yang tersedia untuk publik.",
    actionLabel: "Gunakan URL lain",
  },
  TARGET_UNREACHABLE: {
    title: "Halaman tidak dapat dijangkau",
    message:
      "Situs tujuan tidak merespons. Tunggu beberapa saat lalu coba lagi.",
    actionLabel: "Coba lagi",
  },
  TARGET_TIMEOUT: {
    title: "Audit melewati batas waktu",
    message:
      "Halaman membutuhkan waktu terlalu lama untuk diperiksa dengan aman.",
    actionLabel: "Coba lagi",
  },
  TARGET_BLOCKED_BY_ROBOTS: {
    title: "Audit tidak diizinkan situs",
    message:
      "Aturan robots.txt situs tersebut tidak mengizinkan audit otomatis.",
    actionLabel: "Gunakan URL lain",
  },
  BROWSER_NOT_INSTALLED: {
    title: "Audit belum dapat dijalankan",
    message:
      "Layanan audit sedang tidak siap. Coba lagi beberapa saat atau hubungi pengelola.",
    actionLabel: "Kembali ke beranda",
  },
  AUDIT_RUNTIME_UNAVAILABLE: {
    title: "Layanan audit belum siap",
    message: "Runtime audit sedang tidak tersedia. Coba lagi beberapa saat.",
    actionLabel: "Coba lagi",
  },
  RATE_LIMITED: {
    title: "Batas audit tercapai",
    message:
      "Terlalu banyak audit dibuat dari jaringan ini. Coba lagi setelah jeda.",
    actionLabel: "Kembali ke beranda",
  },
  RESULT_EXPIRED: {
    title: "Hasil audit telah kedaluwarsa",
    message:
      "Hasil disimpan selama tujuh hari. Jalankan audit baru untuk membuat hasil terkini.",
    actionLabel: "Audit ulang",
  },
  AUDIT_NOT_FOUND: {
    title: "Audit tidak ditemukan",
    message:
      "Audit ini tidak tersedia di perangkat atau sudah dihapus dari server.",
    actionLabel: "Mulai audit baru",
  },
  AUDIT_CANCELLED: {
    title: "Audit dibatalkan",
    message: "Proses dihentikan dan artefak sementara sudah dibersihkan.",
    actionLabel: "Mulai audit baru",
  },
  NETWORK_ERROR: {
    title: "Tidak dapat terhubung ke layanan audit",
    message: "Periksa koneksi dan pastikan layanan backend sedang berjalan.",
    actionLabel: "Coba lagi",
  },
  INTERNAL_ERROR: {
    title: "Audit belum berhasil",
    message:
      "Terjadi kendala internal. Tidak ada hasil yang diklaim dari proses ini.",
    actionLabel: "Kembali ke beranda",
  },
};

const LEGACY_CODES: Record<string, PublicErrorCode> = {
  "rate-limit": "RATE_LIMITED",
  expired: "RESULT_EXPIRED",
  "not-found": "AUDIT_NOT_FOUND",
  "internal-error": "INTERNAL_ERROR",
  "browser-failed": "AUDIT_RUNTIME_UNAVAILABLE",
  "audit-timeout": "TARGET_TIMEOUT",
  "robots-disallowed": "TARGET_BLOCKED_BY_ROBOTS",
  "robots-unavailable": "TARGET_BLOCKED_BY_ROBOTS",
  "robots-fetch-failed": "TARGET_UNREACHABLE",
  "dns-lookup-failed": "TARGET_UNREACHABLE",
  "blocked-address": "TARGET_NOT_PUBLIC",
};

export class AuditApiError extends Error {
  code: PublicErrorCode;
  status: number;
  requestId?: string;

  constructor(code: PublicErrorCode, status = 0, requestId?: string) {
    super(ERROR_COPY[code].message);
    this.name = "AuditApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function presentAuditError(error: unknown): PublicErrorCopy & {
  code: PublicErrorCode;
} {
  const candidate =
    error instanceof AuditApiError
      ? error.code
      : error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
  const code =
    typeof candidate === "string" && candidate in ERROR_COPY
      ? (candidate as PublicErrorCode)
      : "INTERNAL_ERROR";
  return { code, ...ERROR_COPY[code] };
}

const configuredBase =
  process.env.NEXT_PUBLIC_AUDIT_API_URL || "http://localhost:8787";
export const AUDIT_API_BASE = configuredBase.replace(/\/$/, "");

function normalizeCode(value: unknown, status: number): PublicErrorCode {
  if (typeof value === "string") {
    if (value in ERROR_COPY) return value as PublicErrorCode;
    if (LEGACY_CODES[value]) return LEGACY_CODES[value];
  }
  if (status === 404) return "AUDIT_NOT_FOUND";
  if (status === 410) return "RESULT_EXPIRED";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${AUDIT_API_BASE}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new AuditApiError("NETWORK_ERROR");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawError = body?.error;
    const rawCode =
      rawError && typeof rawError === "object" ? rawError.code : rawError;
    const requestId =
      rawError && typeof rawError === "object"
        ? rawError.requestId
        : response.headers.get("x-request-id") || undefined;
    throw new AuditApiError(
      normalizeCode(rawCode, response.status),
      response.status,
      typeof requestId === "string" ? requestId : undefined,
    );
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
