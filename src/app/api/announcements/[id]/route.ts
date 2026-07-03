import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { announcementService } from "@/services";
import { announcementUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission("announcement.view");
    const { id } = await context.params;

    return apiSuccess(await announcementService.getById(id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("announcement.update");
    const { id } = await context.params;
    const rawPayload = await request.json();

    if (
      rawPayload &&
      typeof rawPayload === "object" &&
      !Array.isArray(rawPayload) &&
      Object.prototype.hasOwnProperty.call(rawPayload, "status")
    ) {
      throw new AppError(
        "Use as acoes especificas para publicar ou arquivar comunicados.",
        400,
        "ANNOUNCEMENT_STATUS_ACTION_REQUIRED"
      );
    }

    const payload = announcementUpdateSchema.parse(rawPayload);

    return apiSuccess(await announcementService.update(id, payload, user.id));
  } catch (error) {
    if (error instanceof ZodError) return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("announcement.delete");
    const { id } = await context.params;

    return apiSuccess(await announcementService.remove(id, user.id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
