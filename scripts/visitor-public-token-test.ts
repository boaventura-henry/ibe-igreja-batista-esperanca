import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createVisitorFlowToken, verifyVisitorFlowToken, visitorIdentityDigest } from "@/lib/visitor-public-security";

Object.assign(process.env, { VISITOR_RATE_LIMIT_HMAC_SECRET: "rate-secret-for-tests-12345678901234567890", VISITOR_FLOW_TOKEN_SECRET: "flow-secret-for-tests-12345678901234567890", TURNSTILE_SECRET_KEY: "turnstile-test", NEXTAUTH_SECRET: "auth-test" });
const digest = visitorIdentityDigest("18999999999", "1990-05-10");
const token = createVisitorFlowToken(digest, "test-notice", 1_000_000);
const verify = (value: string) => verifyVisitorFlowToken(value, digest, "test-notice", 1_000_000);
assert.equal(verify(token), true);
assert.equal(verify(`${token.slice(0, -2)}${token.at(-2) === "A" ? "B" : "A"}${token.slice(-1)}`), false);
assert.equal(verify(`${token[0] === "A" ? "B" : "A"}${token.slice(1)}`), false);
assert.equal(verify(`${token}!`), false);
assert.equal(verify(`${token}=`), false);
assert.equal(verify(token.slice(0, -1)), false);
assert.equal(verify(`${token}.extra`), false);
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const noncanonical = `${token.slice(0, -1)}${alphabet[alphabet.indexOf(token.at(-1)!) + 1]}`;
assert.equal(Buffer.from(noncanonical.split(".")[1], "base64url").equals(Buffer.from(token.split(".")[1], "base64url")), true);
assert.equal(verify(noncanonical), false);
assert.equal(verifyVisitorFlowToken(token, digest, "test-notice", 1_900_000), false);
assert.equal(verifyVisitorFlowToken(token, "different", "test-notice", 1_000_000), false);
assert.equal(verifyVisitorFlowToken(token, digest, "different", 1_000_000), false);
const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as Record<string, unknown>;
for (const change of [{ v: 2 }, { purpose: "wrong" }]) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, ...change })).toString("base64url");
  const signed = createHmac("sha256", process.env.VISITOR_FLOW_TOKEN_SECRET!).update(encoded).digest("base64url");
  assert.equal(verify(`${encoded}.${signed}`), false);
}
delete process.env.VISITOR_FLOW_TOKEN_SECRET;
assert.throws(() => visitorIdentityDigest("18999999999", "1990-05-10"));
console.log("Visitor token and cryptographic security tests passed.");
