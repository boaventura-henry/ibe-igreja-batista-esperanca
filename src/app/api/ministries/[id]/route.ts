import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { ministryService } from "@/services";
import { ministryUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission("ministry.view");
    const { id } = await context.params;

    return apiSuccess(await ministryService.getById(id));
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
    const user = await requirePermission("ministry.update");
    const { id } = await context.params;
    const payload = ministryUpdateSchema.parse(await request.json());

    return apiSuccess(await ministryService.update(id, payload, user.id));
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
    const user = await requirePermission("ministry.delete");
    const { id } = await context.params;

    return apiSuccess(await ministryService.remove(id, user.id));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
