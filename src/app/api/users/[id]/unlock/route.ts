import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { userService } from "@/services";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requirePermission("user.unlock");
    const { id } = await context.params;

    return apiSuccess(await userService.unlock(id));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
