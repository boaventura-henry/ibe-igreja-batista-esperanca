import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { birthdayService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("dashboard.portal.view");
    return apiSuccess(await birthdayService.getDashboard(), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const appError = error instanceof AppError ? error : toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
