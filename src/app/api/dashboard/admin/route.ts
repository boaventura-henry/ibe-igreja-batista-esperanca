import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { dashboardService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authorization = await requireScheduleAccess("dashboard.admin.view");
    return apiSuccess(
      await dashboardService.getAdminDashboardForUser({
        permissionCodes: authorization.user.permissionCodes,
        accessRoleId: authorization.user.accessRoleId,
        scheduleAccessContext: authorization.accessContext
      }),
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof AppError) {
      const response = apiError(error.message, error.statusCode, error.code);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return response;
    }

    const appError = toAppError(error);
    const response = apiError(appError.message, appError.statusCode, appError.code);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}
