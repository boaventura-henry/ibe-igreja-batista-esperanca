import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { songUsageHistoryService } from "@/services";
import { songUsageHistoryQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const authorization = await requireScheduleAccess("song.view");
    const filters = songUsageHistoryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const { id } = await context.params;

    return apiSuccess(
      await songUsageHistoryService.getHistory(id, filters, authorization),
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(
        error.issues[0]?.message ?? "Filtros invalidos.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const appError = error instanceof AppError ? error : toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
