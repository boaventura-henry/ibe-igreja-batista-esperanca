import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleInstrumentAssignmentService } from "@/services";
import { scheduleInstrumentAssignmentSchema } from "@/validators";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string; memberScheduleId: string }> };
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.view");
    const { id, memberScheduleId } = await context.params;
    return apiSuccess(await scheduleInstrumentAssignmentService.getCurrent(id, memberScheduleId, authorization));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.update");
    const { id, memberScheduleId } = await context.params;
    const input = scheduleInstrumentAssignmentSchema.parse(await request.json());
    return apiSuccess(await scheduleInstrumentAssignmentService.createInitial(id, memberScheduleId, input, authorization), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}