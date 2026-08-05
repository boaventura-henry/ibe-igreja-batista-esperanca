import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { myScheduleService } from "@/services";
import { myScheduleListQuerySchema } from "@/validators";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("mySchedule.view");

    const filters = myScheduleListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    return apiSuccess(await myScheduleService.list(user, filters));
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Filtros invalidos.", 400, "VALIDATION_ERROR");
    }
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
