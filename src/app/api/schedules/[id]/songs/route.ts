import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleSongService } from "@/services";
import { scheduleSongCreateSchema } from "@/validators";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, context: Context) {
  try {
    const authorization = await requireScheduleAccess("schedule.view");
    return apiSuccess(
      await scheduleSongService.list((await context.params).id, authorization)
    );
  } catch (error) {
    const app = toAppError(error);
    return apiError(app.message, app.statusCode, app.code);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const authorization = await requireScheduleAccess("schedule.update");
    return apiSuccess(
      await scheduleSongService.add(
        (await context.params).id,
        scheduleSongCreateSchema.parse(await request.json()),
        authorization
      ),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(
        error.issues[0]?.message ?? "Dados invalidos.",
        400,
        "VALIDATION_ERROR"
      );
    }
    const app = toAppError(error);
    return apiError(app.message, app.statusCode, app.code);
  }
}
