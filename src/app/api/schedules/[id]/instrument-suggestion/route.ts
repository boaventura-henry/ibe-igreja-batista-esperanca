import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleInstrumentAssignmentService } from "@/services";
import { scheduleInstrumentSuggestionQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.update");
    const { id } = await context.params;
    const { memberId } = scheduleInstrumentSuggestionQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    return apiSuccess(
      await scheduleInstrumentAssignmentService.getSuggestion(id, memberId, authorization)
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    }
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
