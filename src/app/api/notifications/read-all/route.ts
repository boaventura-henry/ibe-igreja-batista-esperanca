import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { notificationService } from "@/services";

export async function PATCH() {
  try {
    const user = await requireCurrentUser();
    return apiSuccess(await notificationService.markAllRead(user.id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
