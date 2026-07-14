import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { scheduleService } from "@/services";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission("schedule.update");
    const { id } = await context.params;
    const allowMinistryException = request.nextUrl.searchParams.get("allowMinistryException") === "true";

    return apiSuccess(await scheduleService.listAvailableMembers(id, allowMinistryException), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}