import crypto from "node:crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomJobId() {
  return `aud_${crypto.randomBytes(18).toString("base64url")}`;
}

export function digest(value, secret) {
  return crypto.createHmac("sha256", secret).update(String(value)).digest("hex");
}

export function deriveShareToken({ jobId, accessToken, secret }) {
  return crypto
    .createHmac("sha256", secret)
    .update(`share:${jobId}:${accessToken}`)
    .digest("base64url");
}

export function safeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function clientIp(request, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.socket?.remoteAddress || "unknown";
}

export function bearerToken(request, url) {
  const header = request.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return url.searchParams.get("accessToken") || "";
}
