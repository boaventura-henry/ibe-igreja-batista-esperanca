import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireFinancialAccess } from "@/lib/financial-authorization";
import { financialEntryService } from "@/services";
import { financialEntryUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireFinancialAccess("view");
    const { id } = await context.params;
    return apiSuccess(await financialEntryService.getById(id, authorization));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireFinancialAccess("update");
    const { id } = await context.params;
    const payload = financialEntryUpdateSchema.parse(await request.json());
    return apiSuccess(await financialEntryService.update(id, payload, authorization));
  } catch (error) {
    if (error instanceof ZodError) return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireFinancialAccess("delete");
    const { id } = await context.params;
    return apiSuccess(await financialEntryService.remove(id, authorization));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
