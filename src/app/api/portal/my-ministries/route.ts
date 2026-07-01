import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { memberPortalService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("memberPortal.view");

    return apiSuccess(await memberPortalService.listMinistries(user));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
