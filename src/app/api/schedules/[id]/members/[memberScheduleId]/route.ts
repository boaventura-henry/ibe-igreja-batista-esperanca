import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireAnyPermission, requirePermission } from "@/lib/session";
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
    const user = requiresScheduleUpdate(payload)
      ? await requirePermission("schedule.update")
      : await requireAnyPermission(["schedule.update", "schedule.confirm"]);

    return apiSuccess(await scheduleService.updateMember(id, memberScheduleId, payload, user.id));
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
    const user = await requirePermission("schedule.delete");
    const { id, memberScheduleId } = await context.params;

    return apiSuccess(await scheduleService.removeMember(id, memberScheduleId, user.id));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
