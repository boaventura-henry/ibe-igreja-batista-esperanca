import { VisitorPrivacyChannel } from "@prisma/client";
import { z } from "zod";
import { visitorPrivacyNotice } from "@/config/visitor-privacy";
import { applicationDateInputValue } from "@/lib/application-time";
import { parseVisitorCivilDate } from "@/lib/visitor-civil-date";
import { visitorPublicPrisma } from "@/lib/visitor-public-prisma";
import { visitorPublicSecurity } from "@/lib/visitor-public-security";
import { visitorService } from "@/services/visitor.service";
import { visitorCreateSchema, visitorIdentitySchema } from "@/validators/visitor.validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8192;
const identitySchema = z.object({ action: z.literal("IDENTIFY"), phone: z.string(), birthDate: z.string(), privacy: z.object({ acknowledged: z.literal(true), noticeVersion: z.string().max(64) }).strict(), turnstileToken: z.string().min(1).max(2048) }).strict();
const completeSchema = z.object({ action: z.literal("COMPLETE"), continuationToken: z.string().min(1).max(4096), phone: z.string(), birthDate: z.string(), name: z.string(), address: z.object({ street: z.string().optional(), number: z.string().optional(), complement: z.string().optional(), district: z.string().optional(), city: z.string().optional(), state: z.string().optional() }).strict().optional() }).strict();
const inputSchema = z.discriminatedUnion("action", [identitySchema, completeSchema]);

function reply(status: number, body: unknown, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { status, headers });
}

function fail(status: number, code: string, extra?: HeadersInit) {
  return reply(status, { success: false, error: { code, message: "Nao foi possivel processar a solicitacao." } }, extra);
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    const allowed = (process.env.VISITOR_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (url.origin !== origin || !allowed.includes(origin) || url.host.toLowerCase() !== host.toLowerCase()) return false;
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

async function readJson(request: Request): Promise<{ value?: unknown; status?: number }> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) return { status: 413 };
  if (!request.body) return { status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return { status: 413 }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return { status: 400 }; }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return fail(403, "REQUEST_NOT_ALLOWED");
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(request.headers.get("content-type") ?? "")) return fail(415, "INVALID_REQUEST");
  const body = await readJson(request);
  if (body.status) return fail(body.status, "INVALID_REQUEST");
  const input = inputSchema.safeParse(body.value);
  if (!input.success) return fail(400, "INVALID_REQUEST");
  const identity = visitorIdentitySchema.safeParse(input.data);
  if (!identity.success) return fail(400, "INVALID_REQUEST");
  if (process.env.NODE_ENV === "production" && visitorPrivacyNotice.status !== "APPROVED") return fail(503, "SERVICE_UNAVAILABLE");
  if (input.data.action === "IDENTIFY" && input.data.privacy.noticeVersion !== visitorPrivacyNotice.version) return fail(400, "INVALID_REQUEST");
  try {
    const birthDate = identity.data.birthDate.toISOString().slice(0, 10);
    const digest = visitorPublicSecurity.visitorIdentityDigest(identity.data.phone, birthDate);
    const limit = await visitorPublicSecurity.limitVisitorIdentity(digest);
    if (!limit.success) return fail(429, "RATE_LIMITED", { "Retry-After": String(limit.retryAfter) });
    const privacy = { noticeVersion: visitorPrivacyNotice.version, channel: VisitorPrivacyChannel.PUBLIC_VISIT_FORM };
    const visitDate = parseVisitorCivilDate(applicationDateInputValue())!;
    if (input.data.action === "IDENTIFY") {
      const verification = await visitorPublicSecurity.verifyVisitorTurnstile(input.data.turnstileToken);
      if (verification === "unavailable") return fail(503, "SERVICE_UNAVAILABLE");
      if (verification !== "valid") return fail(400, "HUMAN_VERIFICATION_FAILED");
      const existing = await visitorService.checkInExisting({ ...identity.data, privacy, visitDate }, visitorPublicPrisma);
      if (!existing) return reply(200, { success: true, data: { state: "PROFILE_REQUIRED", continuationToken: visitorPublicSecurity.createVisitorFlowToken(digest, privacy.noticeVersion) } });
    } else {
      if (!visitorPublicSecurity.verifyVisitorFlowToken(input.data.continuationToken, digest, privacy.noticeVersion)) return fail(400, "FLOW_EXPIRED");
      const visitor = visitorCreateSchema.safeParse({ ...input.data.address, ...identity.data, birthDate, name: input.data.name });
      if (!visitor.success) return fail(400, "INVALID_REQUEST");
      await visitorService.checkIn({ visitor: visitor.data, privacy, visitDate, reactivateInactive: true }, visitorPublicPrisma);
    }
    return reply(200, { success: true, data: { state: "COMPLETED", message: "Sua visita de hoje foi registrada." } });
  } catch { return fail(503, "SERVICE_UNAVAILABLE"); }
}

function methodNotAllowed() { return fail(405, "REQUEST_NOT_ALLOWED", { Allow: "POST" }); }
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
