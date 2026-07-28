import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { notificationService } from "@/services";
import { notificationPreferencesUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const response = apiSuccess(await notificationService.getPreferences(user.id));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const input = notificationPreferencesUpdateSchema.parse(await request.json());
    return apiSuccess(await notificationService.updatePreferences(user.id, input));
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(
        error.issues[0]?.message ?? "Preferencias invalidas.",
        400,
        "VALIDATION_ERROR"
      );
    }
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
