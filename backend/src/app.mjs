import fs from "node:fs";
import path from "node:path";

import { checkUrl } from "../../engine/src/fetcher/url-policy.mjs";
import {
  bearerToken,
  clientIp,
  deriveShareToken,
  digest,
  randomJobId,
  randomToken,
  safeEqualHex,
} from "./security.mjs";

const ARTIFACTS = Object.freeze({
  reader: { file: "reader.html", type: "text/html; charset=utf-8" },
  patched: { file: "patched.html", type: "text/html; charset=utf-8" },
  "report.pdf": { file: "report.pdf", type: "application/pdf" },
  screenshot: { file: "after.png", type: "image/png" },
});

function send(response, status, body, headers = {}) {
  const payload = body === null ? "" : JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(payload);
}

async function readJson(request, limit) {
  if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    const error = new Error("Gunakan Content-Type application/json.");
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("Body permintaan terlalu besar.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("JSON tidak valid.");
    error.status = 400;
    throw error;
  }
}

function publicJob(job, store) {
  return {
    jobId: job.id,
    url: job.targetUrl,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    queuePosition: store.queuePosition(job.id),
    attempts: job.attempts,
    canCancel: job.status === "queued" || job.status === "running",
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    expiresAt: new Date(job.expiresAt).toISOString(),
    error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
  };
}

function authorizedJob({ store, config, id, token }) {
  const job = store.getJob(id);
  if (!job || !token) return null;
  return safeEqualHex(job.tokenHash, digest(token, config.secret)) ? job : null;
}

function setCors(request, response, config) {
  const origin = request.headers.origin;
  if (origin && config.frontendOrigins.includes(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("access-control-allow-headers", "Authorization, Content-Type");
    response.setHeader("access-control-max-age", "600");
    return true;
  }
  return !origin;
}

function serveArtifact(response, job, artifact, config, suppliedToken) {
  const expected = digest(suppliedToken, config.secret);
  if (!suppliedToken || !safeEqualHex(job.shareTokenHash, expected)) {
    send(response, 404, { error: "not-found", message: "Artefak tidak ditemukan." });
    return;
  }
  if (job.status !== "completed" || job.expiresAt <= Date.now()) {
    send(response, 410, { error: "expired", message: "Artefak sudah kedaluwarsa." });
    return;
  }
  const definition = ARTIFACTS[artifact];
  const file = definition && path.join(job.artifactDir, definition.file);
  if (!definition || !file.startsWith(job.artifactDir) || !fs.existsSync(file)) {
    send(response, 404, { error: "not-found", message: "Artefak tidak ditemukan." });
    return;
  }
  const stat = fs.statSync(file);
  response.writeHead(200, {
    "content-type": definition.type,
    "content-length": stat.size,
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
  });
  fs.createReadStream(file).pipe(response);
}

export function createApp({ config, store, worker }) {
  return async function app(request, response) {
    try {
      const url = new URL(request.url, "http://backend.local");
      if (!setCors(request, response, config)) {
        send(response, 403, { error: "origin-not-allowed", message: "Origin frontend tidak diizinkan." });
        return;
      }
      if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { ok: true, worker: "ready", concurrency: config.concurrency });
        return;
      }

      if (request.method === "GET" && url.pathname === "/audits/cache") {
        const verdict = checkUrl(url.searchParams.get("url"));
        if (!verdict.ok) {
          send(response, 400, { error: verdict.code, message: verdict.message });
          return;
        }
        const cached = store.findReusable(verdict.url, Date.now());
        send(response, 200, {
          available: Boolean(cached),
          capturedAt: cached?.finishedAt ? new Date(cached.finishedAt).toISOString() : null,
          expiresAt: cached ? new Date(cached.expiresAt).toISOString() : null,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/audits") {
        const body = await readJson(request, config.maxBodyBytes);
        const verdict = checkUrl(body.url);
        if (!verdict.ok) {
          send(response, 400, { error: verdict.code, message: verdict.message });
          return;
        }
        const ipHash = digest(clientIp(request, config), config.secret);
        const since = Date.now() - config.rateWindowMs;
        const used = store.countRecentByIp(ipHash, since);
        if (used >= config.rateLimit) {
          send(response, 429, {
            error: "rate-limit",
            message: `Batas ${config.rateLimit} audit per jam sudah tercapai.`,
          }, { "retry-after": "3600" });
          return;
        }

        const id = randomJobId();
        const accessToken = randomToken();
        const shareToken = deriveShareToken({ jobId: id, accessToken, secret: config.secret });
        const now = Date.now();
        const job = store.createJob({
          id,
          tokenHash: digest(accessToken, config.secret),
          shareTokenHash: digest(shareToken, config.secret),
          ipHash,
          targetUrl: verdict.url,
          createdAt: now,
          expiresAt: now + config.retentionMs,
          artifactDir: path.join(config.artifactsDir, id),
        });
        const cached = body.reuseExisting === true
          ? store.findReusable(verdict.url, now)
          : null;
        if (cached && cached.id !== job.id && fs.existsSync(cached.artifactDir)) {
          fs.cpSync(cached.artifactDir, job.artifactDir, { recursive: true });
          store.completeQueued(job.id, cached.result);
        } else {
          worker.kick();
        }
        const current = store.getJob(job.id);
        send(response, current.status === "completed" ? 200 : 202, {
          jobId: id,
          accessToken,
          status: current.status,
          statusPath: `/audits/${id}`,
          expiresAt: new Date(current.expiresAt).toISOString(),
        }, { location: `/audits/${id}` });
        return;
      }

      const artifactMatch = url.pathname.match(/^\/audits\/([^/]+)\/artifacts\/([^/]+)$/);
      if (request.method === "GET" && artifactMatch) {
        const job = store.getJob(artifactMatch[1]);
        if (!job) { send(response, 404, { error: "not-found", message: "Audit tidak ditemukan." }); return; }
        serveArtifact(response, job, artifactMatch[2], config, url.searchParams.get("token") || "");
        return;
      }

      const resultMatch = url.pathname.match(/^\/audits\/([^/]+)\/result$/);
      if (request.method === "GET" && resultMatch) {
        const accessToken = bearerToken(request, url);
        const job = authorizedJob({ store, config, id: resultMatch[1], token: accessToken });
        if (!job) { send(response, 404, { error: "not-found", message: "Audit tidak ditemukan." }); return; }
        if (job.status !== "completed") {
          send(response, 409, { error: "not-ready", job: publicJob(job, store) });
          return;
        }
        const shareToken = deriveShareToken({ jobId: job.id, accessToken, secret: config.secret });
        const base = `/audits/${job.id}/artifacts`;
        send(response, 200, {
          job: publicJob(job, store),
          result: job.result,
          links: {
            reader: `${base}/reader?token=${encodeURIComponent(shareToken)}`,
            patched: `${base}/patched?token=${encodeURIComponent(shareToken)}`,
            reportPdf: `${base}/report.pdf?token=${encodeURIComponent(shareToken)}`,
            screenshot: `${base}/screenshot?token=${encodeURIComponent(shareToken)}`,
          },
        });
        return;
      }

      const jobMatch = url.pathname.match(/^\/audits\/([^/]+)$/);
      if (jobMatch && (request.method === "GET" || request.method === "DELETE")) {
        const token = bearerToken(request, url);
        const job = authorizedJob({ store, config, id: jobMatch[1], token });
        if (!job) { send(response, 404, { error: "not-found", message: "Audit tidak ditemukan." }); return; }
        if (request.method === "DELETE") {
          const updated = worker.cancel(job.id);
          send(response, 202, { job: publicJob(updated, store) });
        } else {
          send(response, 200, { job: publicJob(job, store) });
        }
        return;
      }

      send(response, 404, { error: "not-found", message: "Endpoint tidak ditemukan." });
    } catch (error) {
      send(response, error.status || 500, {
        error: error.status ? "bad-request" : "internal-error",
        message: error.status ? error.message : "Backend mengalami kesalahan internal.",
      });
    }
  };
}
