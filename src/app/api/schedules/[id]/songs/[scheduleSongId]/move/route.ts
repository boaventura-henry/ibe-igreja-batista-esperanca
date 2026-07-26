import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleSongService } from "@/services";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; scheduleSongId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    const authorization = await requireScheduleAccess("schedule.update");
    const params = await context.params;
    const direction = z
      .object({ direction: z.enum(["up", "down"]) })
      .parse(await request.json());
    return apiSuccess(
      await scheduleSongService.reorder(
        params.id,
        params.scheduleSongId,
        direction.direction,
        authorization
      )
    );
  } catch (error) {
    const app = toAppError(error);
    return apiError(app.message, app.statusCode, app.code);
  }
}
