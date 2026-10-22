import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { GET, POST } from "@/app/api/public/visitor-check-ins/route";
import { visitorPrivacyNotice } from "@/config/visitor-privacy";
import { createVisitorFlowToken, limitVisitorIdentity, verifyVisitorFlowToken, verifyVisitorTurnstile, visitorIdentityDigest, visitorPublicSecurity } from "@/lib/visitor-public-security";
import { visitorService } from "@/services/visitor.service";

const origin = "http://localhost:3000";
Object.assign(process.env, {
  NODE_ENV: "test", VISITOR_ALLOWED_ORIGINS: origin,
  VISITOR_RATE_LIMIT_HMAC_SECRET: "rate-test-secret-12345678901234567890",
  VISITOR_FLOW_TOKEN_SECRET: "flow-test-secret-12345678901234567890",
  TURNSTILE_SECRET_KEY: "test-key", TURNSTILE_ALLOWED_HOSTNAMES: "localhost"
});
const phone = "18999999999";
const birthDate = "1990-05-10";
const identity = { phone, birthDate };
const identify = { action: "IDENTIFY", ...identity, privacy: { acknowledged: true, noticeVersion: visitorPrivacyNotice.version }, turnstileToken: "test-token" };
const counts = new Map<string, number>();
let lookupCount = 0;
let completeCount = 0;
let verificationCount = 0;
let existing = false;
let unavailable = false;
let verification: "valid" | "invalid" | "unavailable" = "valid";
const initialSecurity = { ...visitorPublicSecurity };
const initialService = { ...visitorService };
const originalFetch = globalThis.fetch;

visitorPublicSecurity.limitVisitorIdentity = async (key) => {
  if (unavailable) throw new Error("sensitive Redis error");
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.ok(!key.includes(phone) && !key.includes(birthDate));
  const count = (counts.get(key) ?? 0) + 1;
  counts.set(key, count);
  return { success: count <= 10, retryAfter: 600 };
};
visitorPublicSecurity.verifyVisitorTurnstile = async () => { verificationCount += 1; return verification; };
visitorService.checkInExisting = async () => { lookupCount += 1; return existing; };
visitorService.checkIn = async () => { completeCount += 1; return {} as Awaited<ReturnType<typeof visitorService.checkIn>>; };

function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/public/visitor-check-ins`, { method: "POST", headers: { origin, host: "localhost:3000", "content-type": "application/json", ...headers }, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
}

async function main() {
  const digest = visitorIdentityDigest(phone, birthDate);
  const token = createVisitorFlowToken(digest, visitorPrivacyNotice.version, 1_000_000);
  assert.ok(verifyVisitorFlowToken(token, digest, visitorPrivacyNotice.version, 1_000_000));
  assert.ok(!verifyVisitorFlowToken(token, digest, visitorPrivacyNotice.version, 1_900_000));
  assert.ok(!verifyVisitorFlowToken(`${token.slice(0, -1)}!`, digest, visitorPrivacyNotice.version, 1_000_000));
  assert.equal(verifyVisitorFlowToken(`${token}=`, digest, visitorPrivacyNotice.version, 1_000_000), false);
  assert.equal(verifyVisitorFlowToken(token.slice(0, -1), digest, visitorPrivacyNotice.version, 1_000_000), false);
  assert.equal(verifyVisitorFlowToken(`${token}.extra`, digest, visitorPrivacyNotice.version, 1_000_000), false);
  assert.equal(verifyVisitorFlowToken(`${token[0] === "A" ? "B" : "A"}${token.slice(1)}`, digest, visitorPrivacyNotice.version, 1_000_000), false);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alternate = `${token.slice(0, -1)}${alphabet[alphabet.indexOf(token.at(-1)!) + 1]}`;
  assert.equal(Buffer.from(alternate.split(".")[1], "base64url").equals(Buffer.from(token.split(".")[1], "base64url")), true);
  assert.equal(verifyVisitorFlowToken(alternate, digest, visitorPrivacyNotice.version, 1_000_000), false);
  assert.ok(!verifyVisitorFlowToken(token, "wrong", visitorPrivacyNotice.version, 1_000_000));
  assert.ok(!verifyVisitorFlowToken(token, digest, "other", 1_000_000));
  const originalRateSecret = process.env.VISITOR_RATE_LIMIT_HMAC_SECRET!;
  const originalFlowSecret = process.env.VISITOR_FLOW_TOKEN_SECRET!;
  delete process.env.VISITOR_RATE_LIMIT_HMAC_SECRET;
  assert.throws(() => visitorIdentityDigest(phone, birthDate));
  process.env.VISITOR_RATE_LIMIT_HMAC_SECRET = originalRateSecret;
  delete process.env.VISITOR_FLOW_TOKEN_SECRET;
  assert.throws(() => visitorIdentityDigest(phone, birthDate));
  process.env.VISITOR_FLOW_TOKEN_SECRET = originalRateSecret;
  assert.throws(() => visitorIdentityDigest(phone, birthDate));
  process.env.VISITOR_FLOW_TOKEN_SECRET = originalFlowSecret;
  process.env.NEXTAUTH_SECRET = originalFlowSecret;
  assert.throws(() => visitorIdentityDigest(phone, birthDate));
  delete process.env.NEXTAUTH_SECRET;
  process.env.TURNSTILE_SECRET_KEY = originalFlowSecret;
  assert.throws(() => visitorIdentityDigest(phone, birthDate));
  process.env.TURNSTILE_SECRET_KEY = "test-key";
  const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as Record<string, unknown>;
  assert.ok(!JSON.stringify(payload).includes(phone) && !JSON.stringify(payload).includes(birthDate));
  for (const change of [{ v: 2 }, { purpose: "wrong" }]) {
    const encoded = Buffer.from(JSON.stringify({ ...payload, ...change })).toString("base64url");
    const signed: string = createHmac("sha256", process.env.VISITOR_FLOW_TOKEN_SECRET!).update(encoded).digest("base64url");
    assert.equal(verifyVisitorFlowToken(`${encoded}.${signed}`, digest, visitorPrivacyNotice.version, 1_000_000), false);
  }
  const sw = await GET();
  assert.equal(sw.status, 405);
  assert.equal(sw.headers.get("cache-control"), "no-store");
  for (const [req, expected] of [
    [request(identify, { origin: "https://evil.example" }), 403],
    [request(identify, { host: "evil.example" }), 403],
    [new Request(`${origin}/api/public/visitor-check-ins`, { method: "POST", headers: { host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify(identify) }), 403],
    [request(identify, { "content-type": "text/plain" }), 415],
    [request("{"), 400],
    [request("x".repeat(8193)), 413],
    [request({ ...identify, phone: "invalid" }), 400],
    [request({ ...identify, birthDate: "2999-01-01" }), 400],
    [request({ ...identify, privacy: { acknowledged: false, noticeVersion: visitorPrivacyNotice.version } }), 400],
    [request({ ...identify, privacy: { acknowledged: true, noticeVersion: "wrong" } }), 400],
    [request({ ...identify, turnstileToken: "" }), 400]
  ] as const) {
    const response = await POST(req);
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(lookupCount, 0);
  verification = "invalid";
  assert.equal((await POST(request(identify))).status, 400);
  verification = "unavailable";
  assert.equal((await POST(request(identify))).status, 503);
  assert.equal(lookupCount, 0);
  verification = "valid";
  counts.clear();
  const response = await POST(request(identify));
  const data = await response.json() as { data: { state: string; continuationToken: string } };
  assert.equal(data.data.state, "PROFILE_REQUIRED");
  assert.ok(!JSON.stringify(data).includes(phone));
  const verificationBefore = verificationCount;
  const complete = { action: "COMPLETE", ...identity, name: "Pessoa Exemplo", continuationToken: data.data.continuationToken };
  assert.equal((await POST(request(complete))).status, 200);
  assert.equal(completeCount, 1);
  assert.equal(verificationCount, verificationBefore);
  assert.equal((await POST(request({ ...complete, address: { street: "Rua", number: "1", complement: "A", district: "Centro", city: "Cidade", state: "SP" } }))).status, 200);
  assert.equal((await POST(request({ ...complete, name: "x" }))).status, 400);
  assert.equal((await POST(request({ ...complete, phone: "18999999997" }))).status, 400);
  assert.equal((await POST(request({ ...complete, continuationToken: "invalid" }))).status, 400);
  existing = true;
  const already = await POST(request(identify));
  assert.deepEqual(await already.json(), { success: true, data: { state: "COMPLETED", message: "Sua visita de hoje foi registrada." } });
  visitorService.checkIn = async () => { throw new Error(`database error containing ${phone}`); };
  const logged: string[] = [];
  const previousError = console.error;
  console.error = (...values: unknown[]) => { logged.push(values.map(String).join(" ")); };
  let safeError: Response;
  try { safeError = await POST(request(complete)); } finally { console.error = previousError; }
  assert.equal(safeError.status, 503);
  assert.ok(!JSON.stringify(await safeError.json()).includes(phone));
  assert.ok(!logged.join(" ").includes(phone));
  visitorService.checkIn = async () => { completeCount += 1; return {} as Awaited<ReturnType<typeof visitorService.checkIn>>; };
  counts.clear();
  for (let i = 0; i < 10; i += 1) assert.equal((await POST(request(identify))).status, 200);
  const limited = await POST(request(identify));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  assert.equal((await POST(request({ ...identify, phone: "18999999998" }))).status, 200);
  unavailable = true;
  const failure = await POST(request(identify));
  assert.equal(failure.status, 503);
  assert.ok(!JSON.stringify(await failure.json()).includes("Redis"));
  unavailable = false;
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal((await POST(request(identify))).status, 403); // HTTP localhost is not accepted in production.
  process.env.VISITOR_ALLOWED_ORIGINS = "https://example.test";
  const productionRequest = new Request("https://example.test/api/public/visitor-check-ins", {
    method: "POST", headers: { origin: "https://example.test", host: "example.test", "content-type": "application/json" }, body: JSON.stringify(identify)
  });
  assert.equal((await POST(productionRequest)).status, 503);
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.VISITOR_ALLOWED_ORIGINS = origin;
  globalThis.fetch = async () => Response.json({ success: true, hostname: "localhost", action: "visitor_identify" });
  assert.equal(await verifyVisitorTurnstile("test"), "valid");
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  process.env.TURNSTILE_SECRET_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ success: true, hostname: "wrong", action: "visitor_identify" });
  assert.equal(await verifyVisitorTurnstile("test"), "invalid");
  globalThis.fetch = async () => Response.json({ success: true, hostname: "localhost", action: "wrong" });
  assert.equal(await verifyVisitorTurnstile("test"), "invalid");
  globalThis.fetch = async () => Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
  assert.equal(await verifyVisitorTurnstile("test"), "invalid");
  let definitiveAttempts = 0;
  globalThis.fetch = async () => { definitiveAttempts += 1; return Response.json({ success: false, "error-codes": ["invalid-input-response"] }); };
  assert.equal(await verifyVisitorTurnstile("test"), "invalid");
  assert.equal(definitiveAttempts, 1);
  globalThis.fetch = async () => Response.json({ success: false, "error-codes": ["internal-error"] });
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  globalThis.fetch = async () => Response.json({});
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  let attempts = 0;
  globalThis.fetch = async () => { attempts += 1; throw new Error("network"); };
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  assert.equal(attempts, 2);
  attempts = 0;
  globalThis.fetch = async () => { attempts += 1; throw new DOMException("timeout", "TimeoutError"); };
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  assert.equal(attempts, 2);
  const idempotencyKeys: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const data = JSON.parse(String(init?.body)) as { idempotency_key: string };
    idempotencyKeys.push(data.idempotency_key);
    return idempotencyKeys.length === 1 ? new Response(null, { status: 503 }) : Response.json({ success: true, hostname: "localhost", action: "visitor_identify" });
  };
  assert.equal(await verifyVisitorTurnstile("test"), "valid");
  assert.equal(idempotencyKeys.length, 2);
  assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "test-redis-token" });
  let redisPayload = "";
  globalThis.fetch = async (_input, init) => {
    redisPayload = String(init?.body);
    return Response.json([{ result: [9, 10] }]);
  };
  assert.equal((await limitVisitorIdentity(digest)).success, true);
  assert.ok(redisPayload.includes(digest) && redisPayload.includes("600000"));
  assert.ok(!redisPayload.includes(phone) && !redisPayload.includes(birthDate));
  globalThis.fetch = async () => Response.json([{ result: [-1, 10] }]);
  const redisLimited = await limitVisitorIdentity(digest);
  assert.equal(redisLimited.success, false);
  assert.ok(redisLimited.retryAfter > 0);
  globalThis.fetch = async () => Response.json([{ error: "Redis unavailable" }]);
  await assert.rejects(() => limitVisitorIdentity(digest));
  attempts = 0;
  globalThis.fetch = async () => { attempts += 1; return new Response(null, { status: 500 }); };
  assert.equal(await verifyVisitorTurnstile("test"), "unavailable");
  assert.equal(attempts, 2);
  console.log("Visitor public check-in focused tests passed.");
}

main().finally(() => {
  Object.assign(visitorPublicSecurity, initialSecurity);
  Object.assign(visitorService, initialService);
  globalThis.fetch = originalFetch;
}).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
