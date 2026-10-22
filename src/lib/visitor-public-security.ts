import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const TTL_SECONDS = 15 * 60;
const PURPOSE = "visitor-check-in";

function secret(name: "VISITOR_RATE_LIMIT_HMAC_SECRET" | "VISITOR_FLOW_TOKEN_SECRET") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value) < 32) throw new Error("Visitor security configuration unavailable");
  const other = name === "VISITOR_FLOW_TOKEN_SECRET" ? process.env.VISITOR_RATE_LIMIT_HMAC_SECRET : process.env.VISITOR_FLOW_TOKEN_SECRET;
  if (!other || Buffer.byteLength(other) < 32 || other === value ||
    [value, other].some((item) => item === process.env.NEXTAUTH_SECRET || item === process.env.TURNSTILE_SECRET_KEY)) {
    throw new Error("Visitor security configuration unavailable");
  }
  return value;
}

export function visitorIdentityDigest(phone: string, birthDate: string) {
  return createHmac("sha256", secret("VISITOR_RATE_LIMIT_HMAC_SECRET"))
    .update(`v1|${phone}|${birthDate}`).digest("hex");
}

export async function limitVisitorIdentity(digest: string) {
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "visitor-check-in:v1",
    ephemeralCache: false,
    timeout: 0
  });
  const result = await limiter.limit(digest);
  return { success: result.success, retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
}

function sign(payload: string) {
  return createHmac("sha256", secret("VISITOR_FLOW_TOKEN_SECRET")).update(payload).digest();
}

export function createVisitorFlowToken(identityDigest: string, noticeVersion: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, purpose: PURPOSE, identityDigest, noticeVersion, iat, exp: iat + TTL_SECONDS, nonce: randomUUID() })).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

export function verifyVisitorFlowToken(token: string, identityDigest: string, noticeVersion: string, now = Date.now()) {
  if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  const [payload, signature] = token.split(".");
  if (Buffer.from(payload, "base64url").toString("base64url") !== payload) return false;
  const received = Buffer.from(signature, "base64url");
  const expected = sign(payload);
  if (received.toString("base64url") !== signature || received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!value || typeof value !== "object") return false;
    const data = value as Record<string, unknown>;
    const nowSeconds = Math.floor(now / 1000);
    return data.v === 1 && data.purpose === PURPOSE && data.identityDigest === identityDigest &&
      data.noticeVersion === noticeVersion && typeof data.nonce === "string" && /^[0-9a-f-]{36}$/i.test(data.nonce) &&
      typeof data.iat === "number" && Number.isInteger(data.iat) && data.iat <= nowSeconds &&
      typeof data.exp === "number" && Number.isInteger(data.exp) && data.exp > nowSeconds && data.exp - data.iat === TTL_SECONDS;
  } catch { return false; }
}

export async function verifyVisitorTurnstile(token: string): Promise<"valid" | "invalid" | "unavailable"> {
  const key = process.env.TURNSTILE_SECRET_KEY;
  const hosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!key || hosts.length === 0) return "unavailable";
  const idempotencyKey = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: key, response: token, idempotency_key: idempotencyKey }),
        signal: AbortSignal.timeout(5000), cache: "no-store"
      });
    } catch {
      if (attempt === 0) continue;
      return "unavailable";
    }
    if (response.status >= 500) { if (attempt === 0) continue; return "unavailable"; }
    if (!response.ok) return "unavailable";
    try {
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || typeof (result as { success?: unknown }).success !== "boolean") return "unavailable";
      const data = result as { success: boolean; hostname?: unknown; action?: unknown; "error-codes"?: unknown };
      if (!data.success && Array.isArray(data["error-codes"]) && data["error-codes"].some((code: unknown) => ["internal-error", "missing-input-secret", "invalid-input-secret", "bad-request"].includes(String(code)))) return "unavailable";
      return data.success && typeof data.hostname === "string" && hosts.includes(data.hostname.toLowerCase()) && data.action === "visitor_identify" ? "valid" : "invalid";
    } catch { return "unavailable"; }
  }
  return "unavailable";
}

export const visitorPublicSecurity = {
  visitorIdentityDigest,
  limitVisitorIdentity,
  createVisitorFlowToken,
  verifyVisitorFlowToken,
  verifyVisitorTurnstile
};
