import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { birthdayService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("dashboard.admin.view");
    return apiSuccess(await birthdayService.getDashboard(), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const appError = error instanceof AppError ? error : toAppError(error);
    const response = apiError(appError.message, appError.statusCode, appError.code);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}
