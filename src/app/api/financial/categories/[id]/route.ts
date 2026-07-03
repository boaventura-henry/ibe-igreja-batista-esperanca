import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { financialCategoryService } from "@/services";
import { financialCategoryUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission("financialCategory.view");
    const { id } = await context.params;
    return apiSuccess(await financialCategoryService.getById(id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("financialCategory.update");
    const { id } = await context.params;
    const payload = financialCategoryUpdateSchema.parse(await request.json());
    return apiSuccess(await financialCategoryService.update(id, payload, user.id));
  } catch (error) {
    if (error instanceof ZodError) return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("financialCategory.delete");
    const { id } = await context.params;
    return apiSuccess(await financialCategoryService.remove(id, user.id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
