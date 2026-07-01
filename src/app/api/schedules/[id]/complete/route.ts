import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { scheduleService } from "@/services";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission("schedule.complete");
    const { id } = await context.params;

    return apiSuccess(await scheduleService.complete(id, user.id));
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
