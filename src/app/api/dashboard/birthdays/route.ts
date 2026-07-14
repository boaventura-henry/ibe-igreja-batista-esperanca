import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { birthdayService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("dashboard.admin.view");
    return apiSuccess(await birthdayService.getDashboard());
  } catch (error) {
    const appError = error instanceof AppError ? error : toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
