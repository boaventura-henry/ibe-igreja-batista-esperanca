import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleService } from "@/services";
import { hasLegacyScheduleMemberRoleField, scheduleMemberCreateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.view");
    const { id } = await context.params;

    return apiSuccess(await scheduleService.listMembers(id, authorization));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("schedule.update");
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (hasLegacyScheduleMemberRoleField(body)) {
      return apiError(
        "O campo role nao e mais aceito. Informe a colecao roles.",
        400,
        "SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED"
      );
    }
    const payload = scheduleMemberCreateSchema.parse(body);

    return apiSuccess(await scheduleService.addMember(id, payload, authorization), { status: 201 });
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
