import { ZodError } from "zod";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { pushNotificationService } from "@/services";

const retryBodySchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120).optional()
});

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission("push.logs.retry");
    const body = retryBodySchema.parse(await request.json().catch(() => ({})));
    const headerKey = request.headers.get("Idempotency-Key")?.trim() || null;
    const result = await pushNotificationService.retryFailed((await context.params).id, user.id, body.idempotencyKey ?? headerKey);
    const response = apiSuccess(result);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}