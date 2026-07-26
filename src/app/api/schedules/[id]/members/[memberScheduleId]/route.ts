import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleService } from "@/services";
import { scheduleMemberUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; memberScheduleId: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

function requiresScheduleUpdate(payload: Record<string, unknown>) {
  return Boolean(payload.memberId || payload.role || payload.replacedByMemberId);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id, memberScheduleId } = await context.params;
    const payload = scheduleMemberUpdateSchema.parse(await request.json());
    const authorization = requiresScheduleUpdate(payload)
      ? await requireScheduleAccess("schedule.update")
      : await requireScheduleAccess(["schedule.update", "schedule.confirm"]);

    return apiSuccess(
      await scheduleService.updateMember(id, memberScheduleId, payload, authorization)
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    }

    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.delete");
    const { id, memberScheduleId } = await context.params;

    return apiSuccess(
      await scheduleService.removeMember(id, memberScheduleId, authorization)
    );
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
