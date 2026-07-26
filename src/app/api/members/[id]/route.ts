import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { requirePermission } from "@/lib/session";
import { memberService } from "@/services";
import { memberUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("member.view");

    const { id } = await context.params;
    const member = await memberService.getById(id, authorization);

    return apiSuccess(member);
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireScheduleAccess("member.update");
    const { id } = await context.params;
    const payload = memberUpdateSchema.parse(await request.json());
    const member = await memberService.update(id, payload, authorization);

    return apiSuccess(member);
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
    const user = await requirePermission("member.delete");
    const { id } = await context.params;
    const result = await memberService.remove(id, user.id);

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
