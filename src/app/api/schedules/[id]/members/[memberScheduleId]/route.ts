import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleService } from "@/services";
import { hasLegacyScheduleMemberRoleField, scheduleMemberUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; memberScheduleId: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

function requiresScheduleUpdate(payload: Record<string, unknown>) {
  return Boolean(
    payload.memberId ||
    payload.roles ||
    payload.replacedByMemberId ||
    payload.instrumentAssignment
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id, memberScheduleId } = await context.params;
    const body: unknown = await request.json();
    if (hasLegacyScheduleMemberRoleField(body)) {
      return apiError(
        "O campo role nao e mais aceito. Informe a colecao roles.",
        400,
        "SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED"
      );
    }
    const payload = scheduleMemberUpdateSchema.parse(body);
    const authorization = requiresScheduleUpdate(payload)
      ? await requireScheduleAccess("schedule.update")
      : await requireScheduleAccess(["schedule.update", "schedule.confirm"]);

    return apiSuccess(
      await scheduleService.updateMember(id, memberScheduleId, payload, authorization)
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const code = error.issues[0]?.path[0] === "roles"
        ? "SCHEDULE_MEMBER_ROLES_REQUIRED"
        : "VALIDATION_ERROR";
      return apiError(validationMessage(error), 400, code);
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
