import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatPhone } from "@/utils";
import { isPublicVisitorRegistrationAvailable, optionalAddress, visitorRequestError } from "@/components/visitors/public-visitor-check-in";

const page = readFileSync("src/app/visite-nos/page.tsx", "utf8");
const form = readFileSync("src/components/visitors/PublicVisitorCheckInForm.tsx", "utf8");
const widget = readFileSync("src/components/visitors/TurnstileWidget.tsx", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");

assert.match(page, /Igreja Batista Esperança/);
assert.match(page, /Av\. Ibirapuera, 733/);
assert.match(page, /Jardim Planalto/);
assert.match(page, /Araçatuba\/SP/);
assert.match(page, /Quartas-feiras às 20:00/);
assert.match(page, /Domingos às 19:00/);
assert.ok(!middleware.includes('"/visite-nos"'));
assert.equal(formatPhone("11999999999"), "(11) 99999-9999");
assert.equal(formatPhone("1133334444"), "(11) 3333-4444");
assert.equal(isPublicVisitorRegistrationAvailable({ version: "v1", status: "DRAFT", text: null }), false);
assert.equal(isPublicVisitorRegistrationAvailable({ version: "v1", status: "APPROVED", text: "Aviso" }), true);
assert.deepEqual(optionalAddress({ street: "", number: "", complement: "", district: "", city: "", state: "" }), undefined);
assert.deepEqual(optionalAddress({ street: " Rua ", number: "1", complement: "", district: "", city: "", state: "SP" }), { street: "Rua", number: "1", complement: undefined, district: undefined, city: undefined, state: "SP" });
assert.match(visitorRequestError(429, undefined, "12"), /12/);
assert.match(visitorRequestError(503), /temporariamente indisponivel/);
assert.match(visitorRequestError(400, "FLOW_EXPIRED"), /reiniciado/);
assert.match(form, /action: "IDENTIFY"/);
assert.match(form, /action: "COMPLETE"/);
assert.match(form, /type="date"/);
assert.match(form, /cache: "no-store"/);
assert.match(form, /continuationToken/);
assert.ok(!/localStorage|sessionStorage|console\.log|document\.cookie|URLSearchParams/.test(form));
assert.match(form, /disabled=\{submitting \|\| !turnstileToken\}/);
assert.match(form, /Retry-After/);
assert.match(form, /FLOW_EXPIRED/);
assert.match(form, /aria-invalid/);
assert.match(form, /h-11/);
assert.match(form, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
assert.match(widget, /turnstile\/v0\/api\.js\?render=explicit/);
assert.match(widget, /expired-callback/);
assert.match(widget, /error-callback/);
assert.match(widget, /turnstile\.reset/);
for (const secret of ["TURNSTILE_SECRET_KEY", "VISITOR_RATE_LIMIT_HMAC_SECRET", "VISITOR_FLOW_TOKEN_SECRET", "UPSTASH_REDIS_REST_TOKEN", "NEXTAUTH_SECRET"]) {
  assert.ok(!form.includes(secret) && !widget.includes(secret));
}

console.log("Public visitor page tests passed.");
