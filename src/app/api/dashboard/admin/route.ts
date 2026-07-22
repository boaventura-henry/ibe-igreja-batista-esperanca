import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { dashboardService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("dashboard.admin.view");
    return apiSuccess(
      await dashboardService.getAdminDashboardForUser({
        permissionCodes: user.permissionCodes,
        accessRoleId: user.accessRoleId
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
