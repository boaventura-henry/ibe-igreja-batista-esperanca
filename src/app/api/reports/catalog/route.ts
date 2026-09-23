import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { resolveFinancialAccessContext } from "@/lib/financial-authorization";
import { reportService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("report.view");
    const canUseFinancialReport = user.permissionCodes.includes("financialEntry.view") || user.permissionCodes.includes("ministryFinance.report");
    const financialAuthorization = canUseFinancialReport
      ? { userId: user.id, accessContext: await resolveFinancialAccessContext(user, "report") }
      : undefined;

    return apiSuccess(await reportService.catalog(financialAuthorization));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
