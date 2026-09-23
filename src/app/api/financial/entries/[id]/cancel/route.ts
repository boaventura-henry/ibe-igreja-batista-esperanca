import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireFinancialAccess } from "@/lib/financial-authorization";
import { financialEntryService } from "@/services";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authorization = await requireFinancialAccess("cancel");
    const { id } = await params;
    return apiSuccess(await financialEntryService.cancel(id, authorization));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
