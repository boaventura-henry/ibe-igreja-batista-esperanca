import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { passwordResetRequestService } from "@/services";
import { passwordResetRequestRejectSchema } from "@/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("passwordResetRequest.reject");
    const { id } = await context.params;
    const payload = passwordResetRequestRejectSchema.parse(await request.json());

    return apiSuccess(await passwordResetRequestService.reject(id, payload, user.id));
  } catch (error) {
    if (error instanceof ZodError) return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
