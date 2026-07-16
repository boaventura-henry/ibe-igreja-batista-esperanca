import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { pushNotificationService } from "@/services";
import { pushTestFeedbackSchema } from "@/validators";

export const runtime = "nodejs";

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    return noStore(apiSuccess(await pushNotificationService.recordTestFeedback(user.id, pushTestFeedbackSchema.parse(await request.json()))));
  } catch (error) {
    if (error instanceof ZodError) return noStore(apiError(error.issues[0]?.message ?? "Retorno de teste invÃ¡lido.", 400, "VALIDATION_ERROR"));
    if (error instanceof AppError) return noStore(apiError(error.message, error.statusCode, error.code));
    const appError = toAppError(error);
    return noStore(apiError(appError.message, appError.statusCode, appError.code));
  }
}
