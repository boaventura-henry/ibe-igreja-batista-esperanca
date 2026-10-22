# Visitor public check-in

Configure the origin and Turnstile hostname allowlists explicitly. For local development,
add the exact localhost origin to `VISITOR_ALLOWED_ORIGINS` and use the official
Cloudflare Turnstile test keys and test hostname configuration. Do not bypass Siteverify.
Use distinct random server-only secrets of at least 32 bytes for the rate-limit HMAC
and continuation token, and configure Upstash Redis REST credentials. These values must
never be committed or exposed to the client.

The processing order is origin, content and bounded payload validation, identity
canonicalization, distributed rate limit, Turnstile verification, and finally the
visitor transaction. COMPLETE requires a short-lived signed continuation token from a
verified IDENTIFY rather than a second Turnstile challenge. The draft privacy notice
blocks the endpoint in production until approved.

A future external WAF limit of 120 requests per 10 minutes per IP and JA4 is recommended
as an additional antiflood layer; it does not replace the per-identity limit.
