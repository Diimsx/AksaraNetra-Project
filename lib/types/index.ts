// ===== Shared Types for AksaraNetra Modules =====

// --- Module 1: URL Validator ---
export type ValidationResult =
  | { valid: true; url: string }
  | { valid: false; reason: "invalid_format" | "blocked_host" | "robots_disallowed" | "too_many_redirects" };

// --- Module 2: Page Fetcher ---
export type FetchResult =
  | { success: true; html: string; usedBrowser: boolean }
  | { success: false; error: "timeout" | "forbidden" | "captcha" | "ssl_error" | "response_too_large" | "unknown"; message?: string };

// --- Module 3: Accessibility Analyzer ---
export interface AuditIssue {
  ruleId: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  selector: string;
  nodeCount: number;
  description?: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  totalCount: number;
  timestamp: string;
}

// --- Module 4: Remediation Engine ---
export type RemediationType = "link_name" | "button_name" | "scroll_keyboard";

export interface RemediatedElement {
  type: RemediationType;
  selector: string;
  before: string | null;
  after: string;
}

export interface ManualReviewItem {
  type: "link_name" | "button_name";
  selector: string;
  reason: "no_context_found";
}

export interface RemediationResult {
  html: string;
  fixed: RemediatedElement[];
  manualReview: ManualReviewItem[];
}

// --- Module 5: Renderer ---
export interface RenderResult {
  safeHtml: string;
  manualReviewSummary: ManualReviewItem[];
}

// --- Pipeline (end-to-end) ---
export interface ProcessPipelineResult {
  title: string;
  description: string;
  content: string;
  originalUrl: string;
  processedAt: string;
  auditBefore?: AuditResult;
  auditAfter?: AuditResult;
  fixedCount: number;
  manualReviewCount: number;
}
