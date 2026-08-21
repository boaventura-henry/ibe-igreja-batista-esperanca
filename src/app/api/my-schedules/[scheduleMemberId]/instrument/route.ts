import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { myScheduleService } from "@/services";
import { myScheduleInstrumentChangeSchema } from "@/validators";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ scheduleMemberId: string }> }) {
  try {
    const user = await requirePermission("mySchedule.view");
    return apiSuccess(await myScheduleService.getInstrumentChange((await context.params).scheduleMemberId, user));
  } catch (error) {
    const app = toAppError(error);
    return apiError(app.message, app.statusCode, app.code);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ scheduleMemberId: string }> }) {
  try {
    const user = await requirePermission("mySchedule.view");
    const payload = myScheduleInstrumentChangeSchema.parse(await request.json());
    return apiSuccess(await myScheduleService.changeInstrument((await context.params).scheduleMemberId, payload, user));
  } catch (error) {
    const app = toAppError(error);
    return apiError(app.message, app.statusCode, app.code);
  }
}