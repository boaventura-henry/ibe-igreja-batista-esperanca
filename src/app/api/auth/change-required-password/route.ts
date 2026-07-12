import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { userService } from "@/services";
import { userChangePasswordSchema } from "@/validators";

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const payload = userChangePasswordSchema.parse(await request.json());

    return apiSuccess(await userService.changeOwnPassword(user.id, payload));
  } catch (error) {
    if (error instanceof ZodError) return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
