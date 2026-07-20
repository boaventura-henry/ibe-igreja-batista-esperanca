import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { pushNotificationHealthService } from "@/services";
import { pushNotificationDeviceHealthQuerySchema } from "@/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission("push.logs.view");
    const url = new URL(request.url);
    const query = pushNotificationDeviceHealthQuerySchema.parse(Object.fromEntries(url.searchParams));
    const response = apiSuccess(await pushNotificationHealthService.listDevices(query));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Filtros invalidos.", 400, "VALIDATION_ERROR");
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
