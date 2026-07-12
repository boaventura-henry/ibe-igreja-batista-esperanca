import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { dashboardService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("dashboard.portal.view");

    return apiSuccess(await dashboardService.getPortalDashboard(user.id, user.memberId), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
