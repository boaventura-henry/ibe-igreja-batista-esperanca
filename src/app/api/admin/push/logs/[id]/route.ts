import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { pushNotificationLogService } from "@/services";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: Context) {
  try {
    await requirePermission("push.logs.view");
    const response = apiSuccess(await pushNotificationLogService.getById((await context.params).id));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
