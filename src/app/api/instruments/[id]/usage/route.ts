import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { instrumentUsageHistoryService } from "@/services";
import { instrumentUsageHistoryQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePermission("instrument.view");
    const filters = instrumentUsageHistoryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const { id } = await context.params;

    return apiSuccess(
      await instrumentUsageHistoryService.list(id, filters),
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(
        error.issues[0]?.message ?? "Paginacao invalida.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
