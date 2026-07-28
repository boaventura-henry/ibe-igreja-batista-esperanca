import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { notificationService } from "@/services";
import { notificationListQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const filters = notificationListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const response = apiSuccess(await notificationService.listForUser(user.id, filters));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Filtros invalidos.", 400, "VALIDATION_ERROR");
    }
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
