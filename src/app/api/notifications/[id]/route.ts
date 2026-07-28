import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { notificationService } from "@/services";
import { notificationIdSchema } from "@/validators";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const id = notificationIdSchema.parse((await context.params).id);
    return apiSuccess(await notificationService.remove(id, user.id));
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Notificacao invalida.", 400, "VALIDATION_ERROR");
    }
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
