import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleService } from "@/services";
import { scheduleInitialTeamInstrumentsQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireScheduleAccess("schedule.create");
    const query = scheduleInitialTeamInstrumentsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    return apiSuccess(
      await scheduleService.listEligibleInstrumentsForCreation(
        query.ministryId,
        query.categoryId,
        authorization
      ),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    }
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
