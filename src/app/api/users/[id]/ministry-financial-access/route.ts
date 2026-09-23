import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { ministryFinanceService } from "@/services";
import { ministryFinancialAccessUpdateSchema } from "@/validators";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission("ministryFinance.access.manage");
    const { id } = await context.params;
    return apiSuccess(await ministryFinanceService.getAccessConfiguration(id));
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission("ministryFinance.access.manage");
    const { id } = await context.params;
    const input = ministryFinancialAccessUpdateSchema.parse(await request.json());
    return apiSuccess(await ministryFinanceService.updateAccessConfiguration(id, input, actor.id));
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
