import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireAnyPermission } from "@/lib/session";
import { songService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(["song.view", "schedule.update"]);
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    return apiSuccess({ songs: await songService.options(search) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const appError = error instanceof AppError ? error : toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
